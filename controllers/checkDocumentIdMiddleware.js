const mongoose = require('mongoose');

// Middleware to check if the ID is valid
const checkObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ msg: 'Invalid ID format' });
  }
  next();
};

module.exports = checkObjectId;
