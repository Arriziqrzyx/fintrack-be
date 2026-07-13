const salaryCycleService = require('../services/salaryCycleService');

const getActiveCycle = async (req, res, next) => {
  try {
    const cycle = await salaryCycleService.getActiveCycle(req.userId);
    res.json(cycle);
  } catch (error) {
    next(error);
  }
};

const getAllCycles = async (req, res, next) => {
  try {
    const cycles = await salaryCycleService.getAllCycles(req.userId);
    res.json(cycles);
  } catch (error) {
    next(error);
  }
};

const getCycleById = async (req, res, next) => {
  try {
    const cycle = await salaryCycleService.getCycleById(req.params.id, req.userId);
    res.json(cycle);
  } catch (error) {
    next(error);
  }
};

const forceRebuild = async (req, res, next) => {
  try {
    await salaryCycleService.rebuildUserCycles(req.userId);
    res.json({ message: 'Cycles rebuilt successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveCycle,
  getAllCycles,
  getCycleById,
  forceRebuild
};
