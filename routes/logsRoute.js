// logsRoute.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');
const { getAllLogs } = require('../controllers/auditLogController');


// Route to fetch all audit logs
router.get('/all-logs', auth, isAdmin, getAllLogs);

module.exports = router;
