const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

router.post('/create-tenant', tenantController.createTenant);
router.get('/all-tenants', tenantController.getAllTenants); // Add this route

module.exports = router;
