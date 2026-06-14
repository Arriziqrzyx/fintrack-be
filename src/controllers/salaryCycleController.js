const salaryCycleService = require('../services/salaryCycleService');

const getActiveCycle = async (req, res) => {
  try {
    const cycle = await salaryCycleService.getActiveCycle(req.userId);
    res.json(cycle);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active cycle', error: error.message });
  }
};

const getAllCycles = async (req, res) => {
  try {
    const cycles = await salaryCycleService.getAllCycles(req.userId);
    res.json(cycles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cycles', error: error.message });
  }
};

const getCycleById = async (req, res) => {
  try {
    const cycle = await salaryCycleService.getCycleById(req.params.id, req.userId);
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }
    res.json(cycle);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cycle', error: error.message });
  }
};

const forceRebuild = async (req, res) => {
  try {
    await salaryCycleService.rebuildUserCycles(req.userId);
    res.json({ message: 'Cycles rebuilt successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error rebuilding cycles', error: error.message });
  }
};

module.exports = {
  getActiveCycle,
  getAllCycles,
  getCycleById,
  forceRebuild
};
