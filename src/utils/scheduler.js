const cron = require('node-cron');
const pushNotifierService = require('../services/pushNotifierService');

const startSchedulers = () => {
  console.log('[Scheduler] Initializing cron schedules in Asia/Jakarta timezone...');

  // 1. Daily Transaction Reminder: Everyday at 19:30 Asia/Jakarta
  cron.schedule('30 19 * * *', async () => {
    console.log('[Scheduler] Running Daily Transaction Reminder cron...');
    await pushNotifierService.runDailyReminder();
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  });

  // 2. Salary Cycle Reminder (H-5): Everyday at 10:00 Asia/Jakarta
  cron.schedule('0 10 * * *', async () => {
    console.log('[Scheduler] Running Salary Cycle Reminder H-5 cron...');
    await pushNotifierService.runSalaryCycleReminder();
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  });

  // 3. Weekly AI Insight: Sundays at 20:00 Asia/Jakarta
  cron.schedule('0 20 * * 0', async () => {
    console.log('[Scheduler] Running Weekly AI Insight cron...');
    await pushNotifierService.runWeeklyAIInsight();
  }, {
    scheduled: true,
    timezone: 'Asia/Jakarta'
  });

  console.log('[Scheduler] All schedules registered successfully.');
};

module.exports = {
  startSchedulers
};
