const Tenant = require('../models/Tenant');

const filterByTenant = async (req, res, next) => {
  try {
    const tenantId = req.user.company; // Retrieve tenant ID from authenticated user
    console.log('Company in user request:', tenantId);

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not provided' });
    }

    // Ensure tenant exists
    const tenant = await Tenant.findById(tenantId);
    console.log('Tenant found in tenants:', tenant);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Define filtering criteria for routes that need tenant isolation
    req.queryFilter = { company: tenantId };

    next();
  } catch (error) {
    console.error('Error filtering by tenant:', error);
    res.status(500).json({ error: 'Error applying tenant filter' });
  }
};

module.exports = filterByTenant;
