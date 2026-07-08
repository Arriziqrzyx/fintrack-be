const aiService = require('../services/aiService');

const chat = async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'Messages array is required' });
    }

    const aiResponse = await aiService.handleChat(req.userId, messages);
    res.json({ message: aiResponse });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ message: 'Error processing AI chat', error: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await aiService.getChatHistory(req.userId);
    res.json(history);
  } catch (error) {
    console.error('AI Get History Error:', error);
    res.status(500).json({ message: 'Error fetching chat history', error: error.message });
  }
};

const clearHistory = async (req, res) => {
  try {
    await aiService.clearChatHistory(req.userId);
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('AI Clear History Error:', error);
    res.status(500).json({ message: 'Error clearing chat history', error: error.message });
  }
};

module.exports = {
  chat,
  getHistory,
  clearHistory
};
