// middleware/isAdmin.js

const isAdmin = (req, res, next) => {
  // Check if req.user and req.user.role exist and if the role is 'admin'
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Unauthorized!! 🚫🚫' });
  }
  next();
};

module.exports = isAdmin;
