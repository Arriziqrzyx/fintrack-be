const webpush = require('web-push');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const dashboardService = require('./dashboardService');
const { GoogleGenAI } = require('@google/genai');

// Initialize Web Push VAPID keys
const initWebPush = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      'mailto:support@fintrack.com',
      publicKey,
      privateKey
    );
  } else {
    console.warn('[WebPush] VAPID keys are missing from environment variables.');
  }
};

initWebPush();

// Helper to format currency in Indonesian style (e.g. Rp 2.500.000)
const formatIDR = (val) => {
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
};

/**
 * Send push notification to a user
 */
const sendPush = async (user, type, payload) => {
  // Validate notification settings
  if (!user.notificationSettings || user.notificationSettings[type] === false) {
    console.log(`[PushService] Notification "${type}" disabled for user: ${user.username}`);
    return false;
  }

  // Validate cooldown (max once per calendar day for specific notification type)
  const now = new Date();
  const lastSent = user.lastNotificationSent ? user.lastNotificationSent[type] : null;
  if (lastSent) {
    const lastSentDate = new Date(lastSent).toDateString();
    const nowDate = now.toDateString();
    if (lastSentDate === nowDate) {
      console.log(`[PushService] Cooldown active for type "${type}" for user: ${user.username}`);
      return false;
    }
  }

  const subscriptions = user.pushSubscriptions || [];
  if (subscriptions.length === 0) {
    console.log(`[PushService] No push subscriptions for user: ${user.username}`);
    return false;
  }

  console.log(`[PushService] Sending "${type}" push notification to user: ${user.username}`);

  let activeSubs = [...subscriptions];
  let isPruned = false;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        },
        JSON.stringify(payload)
      );
    } catch (err) {
      console.error(`[PushService] Failed to send push:`, err.message);
      // Prune inactive / expired subscriptions (status 410 Gone / 404 Not Found)
      if (err.statusCode === 410 || err.statusCode === 404) {
        activeSubs = activeSubs.filter(s => s.endpoint !== sub.endpoint);
        isPruned = true;
      }
    }
  }

  // Update cooldown and prune subscriptions in DB
  const updateData = {
    [`lastNotificationSent.${type}`]: now
  };
  if (isPruned) {
    updateData.pushSubscriptions = activeSubs;
  }
  await User.findByIdAndUpdate(user._id, updateData);
  return true;
};

/**
 * Real-time transaction alert checks (Duplicate, Large, Anomaly)
 * Triggered on transaction creation.
 */
const checkTransactionAlerts = async (userId, transaction) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Run duplicate transaction detection
    await checkDuplicateTransaction(user, transaction);

    // Alert checks below apply only to EXPENSE transactions
    if (transaction.type === 'EXPENSE') {
      await checkLargeTransaction(user, transaction);
      await checkSpendingAnomaly(user, transaction);
    }
  } catch (err) {
    console.error('[PushService] Error running real-time alerts:', err);
  }
};

/**
 * 1. Duplicate Transaction Detection
 * Check if a similar transaction was made within +/- 5 minutes
 */
const checkDuplicateTransaction = async (user, newTx) => {
  if (!user.notificationSettings?.duplicateTransaction) return;

  const fiveMinutes = 5 * 60 * 1000;
  const tDate = new Date(newTx.transactionDate);
  const minTime = new Date(tDate.getTime() - fiveMinutes);
  const maxTime = new Date(tDate.getTime() + fiveMinutes);

  const duplicate = await Transaction.findOne({
    userId: user._id,
    _id: { $ne: newTx._id },
    accountId: newTx.accountId,
    type: newTx.type,
    amount: newTx.amount,
    assetCode: newTx.assetCode,
    transactionDate: { $gte: minTime, $lte: maxTime }
  });

  if (duplicate) {
    await sendPush(user, 'duplicateTransaction', {
      title: 'Kemungkinan transaksi duplikat',
      body: `Kami menemukan transaksi lain yang sangat mirip beberapa menit yang lalu. Pastikan kamu tidak mencatat transaksi yang sama dua kali.`
    });
  }
};

/**
 * 2. Large Transaction Detection
 * Exceeds user threshold (default 2,000,000 IDR) or 20% of last 3 months average monthly income
 */
const checkLargeTransaction = async (user, newTx) => {
  if (!user.notificationSettings?.largeTransaction) return;

  let threshold = user.notificationSettings.largeTransactionThreshold || 2000000;

  // If threshold is default, try to calculate 20% of average monthly income
  if (user.notificationSettings.largeTransactionThreshold === 2000000 || !user.notificationSettings.largeTransactionThreshold) {
    const avgIncome = await calculateAverageMonthlyIncome(user._id);
    if (avgIncome > 0) {
      threshold = avgIncome * 0.2;
    }
  }

  if (newTx.baseAmount > threshold) {
    const formattedAmount = newTx.assetCode === 'IDR' 
      ? formatIDR(newTx.amount) 
      : `${newTx.amount} ${newTx.assetCode} (${formatIDR(newTx.baseAmount)})`;

    await sendPush(user, 'largeTransaction', {
      title: 'Pengeluaran besar terdeteksi',
      body: `Baru saja tercatat transaksi sebesar ${formattedAmount}. Pastikan nominal tersebut sudah benar.`
    });
  }
};

/**
 * 3. Spending Anomaly Warning
 * Month-to-date spending exceeds last 3 months average by 20%
 */
const checkSpendingAnomaly = async (user, newTx) => {
  if (!user.notificationSettings?.spendingAnomaly) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Sum current month's expenses
  const currentMonthExpensesAgg = await Transaction.aggregate([
    {
      $match: {
        userId: user._id,
        type: 'EXPENSE',
        transactionDate: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$baseAmount' }
      }
    }
  ]);

  const currentExpenses = currentMonthExpensesAgg[0]?.total || 0;
  const avg3Months = await calculateAverageMonthlyExpense(user._id);

  if (avg3Months > 0 && currentExpenses > avg3Months * 1.2) {
    await sendPush(user, 'spendingAnomaly', {
      title: 'Pengeluaran mulai meningkat',
      body: `Pengeluaranmu bulan ini sudah lebih tinggi dibanding pola biasanya. Coba cek kembali agar tetap sesuai rencana keuangan.`
    });
  }
};

/**
 * 4. Daily Transaction Reminder
 * Checked at 19:30.
 */
const runDailyReminder = async () => {
  try {
    const users = await User.find({ 'notificationSettings.dailyReminder': { $ne: false } });
    
    // Get start/end of today in Jakarta time
    const jakartaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const startOfDayUTC = new Date(Date.UTC(jakartaTime.getFullYear(), jakartaTime.getMonth(), jakartaTime.getDate(), 0 - 7, 0, 0, 0));
    const endOfDayUTC = new Date(Date.UTC(jakartaTime.getFullYear(), jakartaTime.getMonth(), jakartaTime.getDate(), 23 - 7, 59, 59, 999));

    for (const user of users) {
      const txCount = await Transaction.countDocuments({
        userId: user._id,
        transactionDate: { $gte: startOfDayUTC, $lte: endOfDayUTC }
      });

      if (txCount === 0) {
        await sendPush(user, 'dailyReminder', {
          title: 'Belum ada transaksi hari ini',
          body: 'Hari ini belum ada transaksi yang tercatat. Lagi hemat atau belum sempat mencatat pengeluaran?'
        });
      }
    }
  } catch (err) {
    console.error('[PushService] Daily reminder schedule error:', err);
  }
};

/**
 * 5. Salary Cycle Reminder (H-5)
 * Checked daily at 10:00 AM
 */
const runSalaryCycleReminder = async () => {
  try {
    const users = await User.find({ 'notificationSettings.salaryCycle': { $ne: false } });
    
    const jakartaTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const year = jakartaTime.getFullYear();
    const month = jakartaTime.getMonth();
    const day = jakartaTime.getDate();

    // Get last day of current calendar month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const targetDays = [lastDayOfMonth - 4, lastDayOfMonth - 3, lastDayOfMonth - 2, lastDayOfMonth - 1, lastDayOfMonth];

    if (!targetDays.includes(day)) {
      return; // Only notify during the last 5 days of the month
    }

    const remainingDays = lastDayOfMonth - day;

    for (const user of users) {
      const summary = await dashboardService.getSummary(user._id.toString());
      const availableMoney = summary.availableMoney || 0;
      const cycleExpense = summary.monthExpense || 0; // standard month/cycle expense
      
      // Calculate elapsed days in current month/cycle to find average daily spend
      const elapsedDays = day; // standard fallback
      const avgDailySpend = elapsedDays > 0 ? cycleExpense / elapsedDays : 0;
      
      const projectedSpend = avgDailySpend * remainingDays;
      const isSufficient = availableMoney >= projectedSpend;

      if (isSufficient) {
        await sendPush(user, 'salaryCycle', {
          title: 'Kondisi keuangan masih aman',
          body: `Akhir bulan tinggal ${remainingDays} hari lagi. Uang yang masih tersedia sekitar ${formatIDR(availableMoney)}. Jika belum ada rencana digunakan, pertimbangkan untuk menabung atau mengalokasikannya ke tujuan keuanganmu.`
        });
      } else {
        await sendPush(user, 'salaryCycle', {
          title: 'Perlu sedikit menghemat',
          body: `Dengan pola pengeluaran saat ini, saldo kemungkinan tidak cukup sampai akhir bulan. Sebaiknya kurangi pengeluaran yang belum mendesak.`
        });
      }
    }
  } catch (err) {
    console.error('[PushService] Salary cycle reminder schedule error:', err);
  }
};

/**
 * 6. Weekly AI Insight
 * Checked Sundays at 20:00
 */
const runWeeklyAIInsight = async () => {
  try {
    const users = await User.find({ 'notificationSettings.weeklyInsight': { $ne: false } });
    if (users.length === 0) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[PushService] GEMINI_API_KEY is not configured. Skipping Weekly AI Insight.');
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // Date range: past 7 days (Monday 00:00 to Sunday 20:00 WIB)
    const nowJakarta = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const mondayWIB = new Date(nowJakarta);
    // Find last Monday
    const currentDay = nowJakarta.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    mondayWIB.setDate(nowJakarta.getDate() - distanceToMonday);
    
    const startOfWeekUTC = new Date(Date.UTC(mondayWIB.getFullYear(), mondayWIB.getMonth(), mondayWIB.getDate(), 0 - 7, 0, 0, 0));
    const endOfWeekUTC = new Date(Date.UTC(nowJakarta.getFullYear(), nowJakarta.getMonth(), nowJakarta.getDate(), 20 - 7, 0, 0, 0));

    // Previous week range for comparison
    const prevStartOfWeekUTC = new Date(startOfWeekUTC.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevEndOfWeekUTC = new Date(endOfWeekUTC.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const user of users) {
      // 1. Fetch weekly data
      const weeklyTxs = await Transaction.find({
        userId: user._id,
        transactionDate: { $gte: startOfWeekUTC, $lte: endOfWeekUTC }
      }).populate('categoryId');

      const prevWeeklyTxs = await Transaction.find({
        userId: user._id,
        transactionDate: { $gte: prevStartOfWeekUTC, $lte: prevEndOfWeekUTC }
      });

      if (weeklyTxs.length === 0) {
        console.log(`[PushService] No weekly transactions for user ${user.username}, skipping AI insight.`);
        continue;
      }

      // Calculate stats
      let totalIncome = 0;
      let totalExpense = 0;
      const categoryMap = {};

      weeklyTxs.forEach(tx => {
        if (tx.type === 'INCOME') {
          totalIncome += tx.baseAmount;
        } else if (tx.type === 'EXPENSE') {
          totalExpense += tx.baseAmount;
          const catName = tx.categoryId?.name || 'Lainnya';
          categoryMap[catName] = (categoryMap[catName] || 0) + tx.baseAmount;
        }
      });

      // Find top category
      let topCategoryName = 'Tidak ada';
      let topCategoryAmount = 0;
      Object.entries(categoryMap).forEach(([name, amount]) => {
        if (amount > topCategoryAmount) {
          topCategoryAmount = amount;
          topCategoryName = name;
        }
      });

      // Compare with previous week
      let prevTotalExpense = 0;
      prevWeeklyTxs.forEach(tx => {
        if (tx.type === 'EXPENSE') {
          prevTotalExpense += tx.baseAmount;
        }
      });

      let percentageDiffText = 'sama seperti minggu lalu';
      if (prevTotalExpense > 0) {
        const diff = ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100;
        if (diff > 0) {
          percentageDiffText = `lebih boros sekitar ${Math.round(diff)}% dibanding minggu lalu`;
        } else if (diff < 0) {
          percentageDiffText = `lebih hemat sekitar ${Math.round(Math.abs(diff))}% dibanding minggu lalu`;
        }
      }

      // 2. Draft AI Prompt
      const prompt = `Kamu adalah "Atmin Duitmu", asisten keuangan AI FinTrack yang santai, bersahabat, dan terkadang memakai gaya bahasa Gen Z.
Buat ringkasan insight keuangan mingguan berdasarkan data berikut untuk dikirimkan sebagai PUSH NOTIFICATION.
Ingat, teks ini akan dibaca sebagai push notification di HP user, jadi tulislah dengan singkat, menarik, informatif, dan tidak membosankan (maksimal 160 karakter). JANGAN gunakan format markdown tebal (* atau **) atau list. Buat dalam 1-2 kalimat mengalir.

DATA KEUANGAN USER MINGGU INI (Senin - Minggu):
- Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
- Pengeluaran Terbesar: Kategori ${topCategoryName} (Rp ${topCategoryAmount.toLocaleString('id-ID')})
- Perbandingan Pengeluaran: ${percentageDiffText}

Berikan ringkasan yang menarik dan insight singkat!
Contoh format output yang diharapkan:
"Minggu ini pengeluaran terbesar berasal dari kategori Edukasi. Total pengeluaranmu lebih hemat sekitar 18% dibanding minggu lalu. Pertahankan ya!"`;

      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: {
            temperature: 0.7
          }
        });

        const aiBody = response.text ? response.text.trim().replace(/\n/g, ' ') : '';
        if (aiBody) {
          await sendPush(user, 'weeklyInsight', {
            title: 'Ringkasan minggu ini',
            body: aiBody
          });
        }
      } catch (aiErr) {
        console.error(`[PushService] Gemini AI failed for user ${user.username}:`, aiErr);
      }
    }
  } catch (err) {
    console.error('[PushService] Weekly AI insight schedule error:', err);
  }
};

// --- HELPER QUERIES FOR CALCULATIONS ---

const calculateAverageMonthlyIncome = async (userId) => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const incomeAgg = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'INCOME',
        transactionDate: { $gte: threeMonthsAgo, $lt: startOfCurrentMonth }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        },
        monthlyTotal: { $sum: '$baseAmount' }
      }
    }
  ]);

  if (incomeAgg.length === 0) return 0;
  const total = incomeAgg.reduce((sum, item) => sum + item.monthlyTotal, 0);
  return total / 3;
};

const calculateAverageMonthlyExpense = async (userId) => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const expenseAgg = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: 'EXPENSE',
        transactionDate: { $gte: threeMonthsAgo, $lt: startOfCurrentMonth }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        },
        monthlyTotal: { $sum: '$baseAmount' }
      }
    }
  ]);

  if (expenseAgg.length === 0) return 0;
  const total = expenseAgg.reduce((sum, item) => sum + item.monthlyTotal, 0);
  return total / 3;
};

module.exports = {
  sendPush,
  checkTransactionAlerts,
  runDailyReminder,
  runSalaryCycleReminder,
  runWeeklyAIInsight
};
