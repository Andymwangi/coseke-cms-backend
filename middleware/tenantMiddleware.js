const Tenant = require('../models/Tenant');
const dbUtils = require('../utils/dbUtils');

const switchTenantDatabase = async (req, res, next) => {
  const tenantId = req.user.company;
  console.log('company of the requesting user:', tenantId);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID not provided' });
  }

  try {
    // Find the tenant using the company ID
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Use the tenant's ID to determine the database name
    const dbName = `tenant_${tenantId}`;

    // Switch the database connection to the tenant's database
    const connection = await dbUtils.switchToTenantDatabase(dbName);

    // Optionally, you can attach the connection to the request object
    req.tenantConnection = connection;

    console.log(`Switched to and connected to database ${dbName}`);
    next();
  } catch (error) {
    console.error(`Error switching database for tenant ${tenantId}:`, error);
    res.status(500).json({ error: 'Error connecting to tenant database' });
  }
};

module.exports = switchTenantDatabase;