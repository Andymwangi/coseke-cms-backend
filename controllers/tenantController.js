const TenantService = require('../services/tenantService');

const createTenant = async (req, res) => {
  try {
    // Collect tenant data from the request body
    const tenantData = req.body;
    console.log('tenant creation data;',tenantData)

    // Pass the data to the service to create a new tenant
    const tenant = await TenantService.createTenant(tenantData);

    // Send a success response with the created tenant data
    res.status(201).json(tenant);
  } catch (error) {
    // Handle errors and send an error response
    res.status(500).json({ error: error.message });
  }
};

const getAllTenants = async (req, res) => {
  try {
    // Retrieve all tenants using the service
    const tenants = await TenantService.getAllTenants();

    // Send a success response with the tenants data
    res.status(200).json(tenants);
  } catch (error) {
    // Handle errors and send an error response
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createTenant,
  getAllTenants
};
