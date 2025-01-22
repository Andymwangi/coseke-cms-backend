const fs = require('fs-extra');

const ensureFoldersExist = async (req, res, next) => {
  try {
    await fs.ensureDir('contract-attachments');
    next();
  } catch (error) {
    console.error('Error creating folders:', error);
    res.status(500).json({ message: 'Failed to create folders' });
  }
};

module.exports = ensureFoldersExist;
