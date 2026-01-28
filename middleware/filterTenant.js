const Tenant = require('../models/Tenant');

const filterByTenant = async (req, res, next) => {
  try {
    const tenantId = req.user.company; // Retrieve tenant ID from authenticated user
    console.log('Company in user request:', tenantId);

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not provided' });
    }

    // Tenant validation is already done via user.company in authMiddleware
    // No need to query Tenant model again

    // Define filtering criteria for routes that need tenant isolation
    req.queryFilter = { company: tenantId };
    console.log('[filterTenant] Setting queryFilter:', req.queryFilter);

    next();
  } catch (error) {
    console.error('Error filtering by tenant:', error);
    res.status(500).json({ error: 'Error applying tenant filter' });
  }
};

module.exports = filterByTenant;
