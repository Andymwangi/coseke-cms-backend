const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const isAuthenticated = require('../middleware/authMiddleware');

// Register a new user
router.post('/register', authController.register);

// Login a user
router.post('/login', authController.login);

router.post('/request-password-reset', authController.requestPasswordReset);

router.post('/reset-password', authController.resetPassword);

router.post('/verify-otp', authController.verifyOtp);

// Define the route for checking authentication status
router.get('/status', isAuthenticated, (req, res) => {
    res.json({ 
        isAuthenticated: true, 
        user: req.user, 
        tenant: req.user.company // Include tenant information if needed
    });
});

module.exports = router;
