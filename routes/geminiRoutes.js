// routes/geminiRoutes.js

const express = require('express');
const router = express.Router();
const { generateText, limiter, autoComplete } = require('../controllers/geminiController');

// Define the route for generating text
router.post('/generate-text', limiter, generateText);
router.post('/autocomplete', limiter, autoComplete);

module.exports = router;
