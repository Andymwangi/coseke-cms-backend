// users.js

const express = require("express");
const router = express.Router();
const User = require('../models/User');
const auth = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const isAdmin = require("../middleware/isAdmin");
const { auditTrail } = require('../middleware/auditMiddleware');
const {
  getUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserProfile, 
} = require("../controllers/userController");

// Get all users
router.get("/all", auth, getAllUsers); 

// Get user profile by ID
router.get("/:id", auditTrail, auth, getUserById); // Endpoint for fetching user by ID

// Update user profile by ID
router.put("/:id", auth, auditTrail, roleMiddleware(["admin"]), isAdmin, updateUser); // Endpoint for updating user by ID


// User updating their profile
router.put("/profile", auth, auditTrail, updateUserProfile)

// Delete user account by ID
router.delete("/:id", auth, auditTrail, roleMiddleware(["admin"]), isAdmin, deleteUser); // Endpoint for deleting user by ID


// Route to update user role
router.put('/:userId/assign-role', auth, auditTrail, roleMiddleware(['admin']), isAdmin, updateUserRole);



// Get current user profile
router.get("/", auth, getUser); // Endpoint for fetching current user profile

module.exports = router;
