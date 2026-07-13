const aiService = require('../services/aiService');

const chat = async (req, res, next) => {
  try {
    const { messages } = req.body;
    const aiResponse = await aiService.handleChat(req.userId, messages);
    res.json({ message: aiResponse });
  } catch (error) {
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const history = await aiService.getChatHistory(req.userId);
    res.json(history);
  } catch (error) {
    next(error);
  }
};

const clearHistory = async (req, res, next) => {
  try {
    await aiService.clearChatHistory(req.userId);
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  getHistory,
  clearHistory
};
