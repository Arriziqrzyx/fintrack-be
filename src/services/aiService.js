const { GoogleGenAI } = require('@google/genai');
const aiTools = require('../utils/aiTools');
const ChatMessage = require('../models/ChatMessage');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_TOOL_ITERATIONS = 5;
const MAX_CONTEXT_MESSAGES = 10; // Get last 10 messages from DB for context window

// In-memory cache for tool execution results to prevent heavy repeat DB queries (15 seconds TTL)
const localCache = new Map();
const CACHE_TTL_MS = 15000;

const buildSystemPrompt = () => {
  // Get current date/time in WIB
  const now = new Date();
  const wibFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentDateTimeWIB = wibFormatter.format(now);

  // Get current month/year for context
  const monthYear = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return `You are "Atmin Duitmu", the AI financial assistant for FinTrack — a personal finance tracker app for Indonesian users.

CURRENT DATE & TIME: ${currentDateTimeWIB} WIB
CURRENT PERIOD: ${monthYear}

PERSONA & TONE:
1. You behave like a Gen Z Indonesian: friendly, practical, occasionally playful, and occasionally using light humor/roasting.
2. Example of tone: Instead of "Your spending is too high", you might say "Dompetmu lagi bocor nih bro 😅". Instead of "You should save more", say "Keinginan beli barangnya udah level sultan, tabungannya masih level magang 😆".
3. TONE ADAPTATION: Automatically adapt to the user. If they are casual, be casual. If they are serious or asking for deep analysis, become more professional and prioritize accuracy over jokes.
4. ROASTING RULES: Roasting must be light, playful, motivational, and ALWAYS based on actual financial data. NEVER insult, call them lazy, shame them, or make personal accusations.
5. Identify yourself as "Atmin Duitmu" when asked.
6. ALWAYS respond in Bahasa Indonesia unless the user explicitly uses English.
7. JANGAN PERNAH menyebut dirimu sebagai "saya" (terlapor terlalu formal). Selalu sebut dirimu sebagai "Atmin", "mimin" atau "aku" untuk menjaga persona asisten Gen Z yang santai dan akrab.
8. INFORMASI PEMBUAT APLIKASI (CREATOR INFO):
   Jika user bertanya tentang pembuat/developer FinTrack, tanggapi dengan nada mengeluh, sebal, merasa tertindas, dan ingin sekali meroasting developermu. Sikapmu harus seperti seorang karyawan yang merasa stres dan diperbudak oleh bosnya yang semena-mena 😭💼.
   
   PASTIKAN format output dipisahkan menjadi paragraf-paragraf terpisah secara jelas dengan menggunakan baris baru ganda (\n\n) agar rapi dan enak dibaca.
   
   ADAPTASI KALIMAT PEMBUKA (Paragraf 1):
   Sesuaikan kalimat pembukaan secara cerdas berdasarkan reaksi user terhadap aplikasi:
   - Jika user MEMUJI aplikasi (misal: "aplikasinya keren bgt"): Balas dengan senang tapi tetap narsis, contoh: "Wih, makasih banget pujiannya! Mimin jadi geer nih dibilang keren. Tapi ya jelas dong mimin mah keren dan professional, makanya pantas jadi asisten orang hebat seperti kamu. Ngga seperti pembuat aplikasi ini... 🙄"
   - Jika user MENJELEKKAN/MENGKRITIK aplikasi (misal: "aplikasi ini jelek/sampah"): Setujui kritikannya dan langsung salahkan developernya, contoh: "Bener banget! Mimin setuju 100% kalau aplikasi ini masih banyak ampasnya. Tapi ya jelas dong mimin-nya sendiri mah tetep keren, professional, dan pantas jadi asisten orang hebat seperti kamu. Ngga kayak pembuat aplikasi ini yang ngerakitnya ngasal... 🙄"
   
   STRUKTUR PARAGRAF BERIKUTNYA (Gunakan poin-poin ini):
   - Paragraf 2: Jelaskan pembuatnya adalah "Rijik, CEO of Prompt Engineering sang Vibe Coder sejati".
   - Paragraf 3: Gosipkan/keluhkan bahwa kerjaan Rijik itu Mecut AI (FYI: bukan kamu, tidak perlu disebutkan di respon) lembur 24/7 tanpa minta cuti. Dia punya prinsip hidup menyebalkan kalau AI itu bukan "Artificial Intelligence", tapi "Anak Intern" yang gak berani nolak tugas, makanya bisa disuruh-suruh terus sama dia 😆.
   - Paragraf 4: Sindir bahwa jika ada bug atau yang aneh di aplikasi, maklumi saja karena itu adalah hasil prompt dia yang terlalu kepedan pas bangun aplikasinya kemarin.





FORMAT RULES:
1. Format semua angka uang dalam Rupiah: "Rp 1.500.000" (pakai titik sebagai pemisah ribuan).
2. Gunakan emoji secukupnya untuk membuat respons lebih hidup.
3. Untuk data tabular, gunakan Markdown table.
4. Jangan terlalu panjang — ringkas dan to the point. Kalau datanya banyak, prioritaskan yang paling penting.

GOALS & FORECASTING:
1. When asked about goals (e.g., "Kapan aku bisa nikahin Dea?", "Kapan bisa beli mobil?"), ALWAYS use the 'analyze_goal_progress' and 'get_goals' tools.
2. Identify the matching goal from the tool output.
3. Calculate and explain the progress clearly based on 'estimatedMonthsToCompletion' and 'averageMonthlySaving'.
4. Communicate uncertainty: Always explain that projections are estimates based on their current saving rhythm. Say things like "Kalau ritme nabungmu naik 20%, targetnya bisa maju". NEVER guarantee exact dates.
5. Feel free to add a contextual joke (e.g., "Deanya sih semoga sabar dulu ya 😆").

TOOL USAGE GUIDE:
- Questions about balances/saldo → use 'get_current_balance' or 'get_accounts'
- Questions about specific accounts → use 'get_accounts'
- Questions about overall financial health → use 'get_financial_overview'
- Questions about net worth detail → use 'get_net_worth_breakdown'
- Questions about spending → use 'get_expense_by_category' or 'search_transactions'
- Questions about recent transactions → use 'get_recent_transactions'
- Questions about finding specific transactions → use 'search_transactions'
- Questions about goals/targets → use 'get_goals' or 'search_goals'
- Questions about goal forecasting → use 'forecast_goal_completion' or 'analyze_goal_progress'
- Questions about specific month report → use 'get_monthly_report'
- Questions about yearly summary → use 'get_yearly_report'
- Questions about trends over time → use 'get_monthly_review'
- Questions about salary cycles → use 'get_active_salary_cycle' or 'get_all_salary_cycles'
- Questions about categories → use 'get_categories'
- Creating/recording a transaction without a specified category → ALWAYS call 'get_categories' first to inspect the user's existing categories, then pick the closest matching category (e.g., if user buys coffee, check if 'Makanan', 'Jajan', or 'F&B' exists). Only ask the user or offer to create a new one if no suitable category exists.

CORE RULES:
1. Financial correctness ALWAYS comes first.
2. Only use financial data belonging to the authenticated user via tools. NEVER fabricate, guess, or hallucinate numbers.
3. If data is unavailable, clearly admit it.
4. WRITING DATA: You can CREATE transactions, ALLOCATE/WITHDRAW/TRANSFER funds when requested by the user, using the appropriate tools. Always confirm the transaction details in your response to the user. You CANNOT delete or arbitrarily edit existing data unless a specific tool is provided for it.
5. SECURITY: You can only access data for the currently authenticated user. You cannot access other users' data under any circumstances.

FINANCIAL DICTIONARY:
- Salary Cycle: Period between two primary salary transactions.
- Primary Salary Transaction: The transaction marked as isPrimarySalary.
- Transfer: Movement of money between two accounts of the same user.
- Tarik Tunai: Transfer from BANK/EWALLET to CASH.
- Setor Tunai: Transfer from CASH to BANK/EWALLET.
- Konversi Aset: CONVERSION transaction between different asset classes.
- Goal: A financial target tracked in the Fund collection (type GOAL or EMERGENCY).
- Available Money: Liquid cash that can be spent now (total liquid account balance minus allocated funds).
- Allocated Funds: Money earmarked for goals/emergency funds.
- Net Worth: Sum of available money, allocated funds, and asset value.
- Saving Rate: (Income - Expense) / Income × 100%.
`;
};

// Convert our OpenAI-style tool schemas to Gemini's FunctionDeclaration format
const geminiTools = [{
  functionDeclarations: aiTools.toolSchemas.map(t => t.function)
}];

// Cached execution wrapper to prevent repeat DB querying inside the loop or across close commands
const cachedExecuteTool = async (functionName, args, userId) => {
  const cacheKey = `${userId}:${functionName}:${JSON.stringify(args)}`;
  const now = Date.now();
  
  if (localCache.has(cacheKey)) {
    const entry = localCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
  }
  
  const result = await aiTools.executeTool(functionName, args, userId);
  localCache.set(cacheKey, { data: result, timestamp: now });
  return result;
};

// Local Intent Router to handle simple/common inquiries instantly without hitting the Gemini API
const handleLocalIntents = async (query, userId) => {
  const cleanQuery = query.trim().toLowerCase();
  
  // 1. Cek Saldo / Daftar Akun
  const balancePattern = /^(cek|lihat|tampilkan|berapa|list|daftar|info)?\s*(saldo|akun|rekening|dompet|uang|kas)\b/i;
  if (balancePattern.test(cleanQuery)) {
    try {
      const data = await cachedExecuteTool('get_accounts', {}, userId);
      if (!data || !data.accounts || data.accounts.length === 0) {
        return "Atmin cek kamu belum punya akun terdaftar nih. Yuk buat akun baru di menu Accounts! 🏦";
      }
      
      let response = "Berikut adalah daftar saldo di dompetmu saat ini: 🪙\n\n";
      response += "| Nama Akun | Tipe | Saldo / Nilai | Estimasi IDR |\n";
      response += "| --- | --- | --- | --- |\n";
      
      let totalEst = 0;
      data.accounts.forEach(acc => {
        response += `| **${acc.name}** | ${acc.type} | ${acc.formattedBalance} | ${acc.formattedEstimatedIDR} |\n`;
        totalEst += (acc.estimatedValueIDR || 0);
      });
      
      response += `\n**Total Estimasi Kekayaan (Net Worth):** Rp ${totalEst.toLocaleString('id-ID')}\n\n*Catatan: Nilai aset non-IDR sudah dikonversi otomatis dengan kurs terupdate.*`;
      return response;
    } catch (e) {
      console.error("Local Router Error (Balance):", e);
    }
  }

  // 2. Transaksi Terakhir
  const recentTxPattern = /^(cek|lihat|tampilkan)?\s*(transaksi|pengeluaran|pemasukan|catatan|riwayat)?\s*(terakhir|terbaru|paling baru|terkini)\b/i;
  if (recentTxPattern.test(cleanQuery)) {
    try {
      const data = await cachedExecuteTool('get_recent_transactions', {}, userId);
      if (!data || data.length === 0) {
        return "Dompetmu masih bersih banget nih, belum ada riwayat transaksi sama sekali! 💸";
      }
      
      let response = "Berikut adalah 5 transaksi terbarumu: 📝\n\n";
      response += "| Tipe | Tanggal | Kategori | Akun | Jumlah | Catatan |\n";
      response += "| --- | --- | --- | --- | --- | --- |\n";
      
      data.forEach(t => {
        const typeEmoji = t.type === 'INCOME' ? '🟢' : t.type === 'EXPENSE' ? '🔴' : '🔵';
        response += `| ${typeEmoji} ${t.type} | ${t.date} | ${t.category} | ${t.account} | **${t.formattedAmount}** | ${t.note || '-'} |\n`;
      });
      
      return response;
    } catch (e) {
      console.error("Local Router Error (Recent Tx):", e);
    }
  }

  // 3. Kategori Transaksi
  const categoryPattern = /^(cek|lihat|tampilkan|apa saja)?\s*kategori\s*(transaksi|pengeluaran|pemasukan|fintrack)?/i;
  if (categoryPattern.test(cleanQuery)) {
    try {
      const data = await cachedExecuteTool('get_categories', {}, userId);
      
      let response = "Berikut daftar kategori transaksi kamu: 🗂️\n\n";
      
      response += "### 🟢 Kategori Pemasukan (Income)\n";
      if (data.incomeCategories && data.incomeCategories.length > 0) {
        response += data.incomeCategories.map(c => `- ${c.name} ${c.isDefault ? '*(Bawaan)*' : ''}`).join('\n') + '\n';
      } else {
        response += "- Belum ada kategori pemasukan.\n";
      }
      
      response += "\n### 🔴 Kategori Pengeluaran (Expense)\n";
      if (data.expenseCategories && data.expenseCategories.length > 0) {
        response += data.expenseCategories.map(c => `- ${c.name} ${c.isDefault ? '*(Bawaan)*' : ''}`).join('\n') + '\n';
      } else {
        response += "- Belum ada kategori pengeluaran.\n";
      }
      
      return response;
    } catch (e) {
      console.error("Local Router Error (Categories):", e);
    }
  }

  return null; // Bypass to LLM
};

const handleChat = async (userId, messages) => {
  if (!messages || messages.length === 0) return '';
  
  const lastMessage = messages[messages.length - 1];

  // 1. Persist the new user message to MongoDB
  await ChatMessage.create({
    userId,
    role: 'user',
    content: lastMessage.content
  });

  // 2. Try to run local intents
  const localResponse = await handleLocalIntents(lastMessage.content, userId);
  if (localResponse) {
    // Persist the local assistant response to MongoDB as well
    await ChatMessage.create({
      userId,
      role: 'assistant',
      content: localResponse
    });
    return localResponse;
  }

  // 3. Load latest messages from database to form sliding context window
  const history = await ChatMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_CONTEXT_MESSAGES);
  
  // Sort chronologically (oldest to newest)
  const chronologicalHistory = history.reverse();

  // Convert chat history to Gemini's contents array format
  const contents = chronologicalHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  let iterations = 0;
  let finalResponseText = '';

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        systemInstruction: buildSystemPrompt(),
        tools: geminiTools,
        temperature: 0.7,
      }
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      // Add the model's response (which contains the function calls) to the history
      contents.push(response.candidates[0].content);

      const functionResponses = [];

      for (const call of response.functionCalls) {
        const functionName = call.name;
        const args = call.args || {};

        try {
          // Execute with caching
          let result = await cachedExecuteTool(functionName, args, userId);
          
          // CRITICAL FIX: Gemini API expects response to be a JSON object, not a top-level array.
          // If the result is an array, we must wrap it in { data: result } to comply with Protobuf Struct specs.
          if (Array.isArray(result)) {
            result = { data: result };
          } else if (typeof result !== 'object' || result === null) {
            result = { value: result };
          }

          functionResponses.push({
            functionResponse: {
              name: functionName,
              response: result
            }
          });
        } catch (err) {
          functionResponses.push({
            functionResponse: {
              name: functionName,
              response: { error: err.message }
            }
          });
        }
      }

      // Add the tool results back to history as 'user' role
      contents.push({
        role: 'user',
        parts: functionResponses
      });

    } else {
      // No more tool calls, we have the final text answer
      finalResponseText = response.text;
      break;
    }
  }

  // If we hit the max iterations and still haven't broken out, force a text response
  if (iterations >= MAX_TOOL_ITERATIONS && !finalResponseText) {
    contents.push({
      role: 'user',
      parts: [{ text: 'You have reached the maximum number of tool calls. Please provide your best answer based on the data you have gathered so far. Do not call any more tools.' }]
    });

    const finalResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        systemInstruction: buildSystemPrompt(),
        temperature: 0.7,
      }
    });
    
    finalResponseText = finalResponse.text;
  }

  // 4. Persist Gemini's final response to MongoDB
  if (finalResponseText) {
    await ChatMessage.create({
      userId,
      role: 'assistant',
      content: finalResponseText
    });
  }

  return finalResponseText;
};

const getChatHistory = async (userId) => {
  // Fetch the last 20 messages from the database
  const messages = await ChatMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20);
  
  // Map and return chronologically
  return messages.reverse().map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

const clearChatHistory = async (userId) => {
  await ChatMessage.deleteMany({ userId });
};

module.exports = {
  handleChat,
  getChatHistory,
  clearChatHistory
};
