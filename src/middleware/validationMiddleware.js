const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      // Validasi body dan replace dengan data hasil parsing (agar sanitize seperti trim dan lowercase jalan)
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const errorMessages = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({
          message: 'Validation failed',
          errors: errorMessages
        });
      }
      next(error);
    }
  };
};

module.exports = {
  validateBody
};
