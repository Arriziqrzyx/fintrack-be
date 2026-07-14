const User = require('../models/User');

const getVapidPublicKey = async (req, res, next) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({ message: 'VAPID keys not configured on server' });
    }
    return res.json({ publicKey });
  } catch (error) {
    next(error);
  }
};

const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ message: 'Invalid subscription payload' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if subscription already exists to prevent duplicate entries
    const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
    if (!exists) {
      user.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      });
      await user.save();
    }

    return res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user.notificationSettings || {});
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { dailyReminder, salaryCycle, spendingAnomaly, weeklyInsight, largeTransaction, duplicateTransaction, largeTransactionThreshold } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const settings = user.notificationSettings || {
      dailyReminder: true,
      salaryCycle: true,
      spendingAnomaly: true,
      weeklyInsight: true,
      largeTransaction: true,
      duplicateTransaction: true,
      largeTransactionThreshold: 2000000
    };

    if (dailyReminder !== undefined) settings.dailyReminder = Boolean(dailyReminder);
    if (salaryCycle !== undefined) settings.salaryCycle = Boolean(salaryCycle);
    if (spendingAnomaly !== undefined) settings.spendingAnomaly = Boolean(spendingAnomaly);
    if (weeklyInsight !== undefined) settings.weeklyInsight = Boolean(weeklyInsight);
    if (largeTransaction !== undefined) settings.largeTransaction = Boolean(largeTransaction);
    if (duplicateTransaction !== undefined) settings.duplicateTransaction = Boolean(duplicateTransaction);
    if (largeTransactionThreshold !== undefined) settings.largeTransactionThreshold = Number(largeTransactionThreshold);

    user.notificationSettings = settings;
    // Mark modified since notificationSettings is an embedded mixed subdocument
    user.markModified('notificationSettings');
    await user.save();

    return res.json(user.notificationSettings);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVapidPublicKey,
  subscribe,
  getSettings,
  updateSettings
};
