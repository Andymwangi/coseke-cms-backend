const Tenant = require("../models/Tenant");
const dbUtils = require("../utils/dbUtils");
const { v4: uuidv4 } = require("uuid"); // Import UUID for unique license key generation

const createTenant = async (tenantData) => {
  try {
    // Generate a unique license key
    const licenseKey = `LICENSE-${uuidv4()}`;
    console.log("generated license key;", licenseKey);

    // Determine features based on the license type
    const licenseType = tenantData.licenseType || "Free"; // Default to 'Free' if not specified
    let features;
    switch (licenseType) {
      case "Pro":
        features = ["feature1", "feature2", "feature3"]; // List of Pro features
        break;
      case "Enterprise":
        features = ["feature1", "feature2", "feature3", "feature4"]; // List of Enterprise features
        break;
      default:
        features = ["feature1"]; // Default to basic features for Free license
    }

    // Set the expiration date if necessary (for non-Free licenses)
    let expirationDate = null;
    if (licenseType !== "Free") {
      const currentDate = new Date();
      expirationDate = new Date(
        currentDate.setFullYear(currentDate.getFullYear() + 1)
      ); // Set expiration to one year from now
    }

    // Create a new tenant with license details
    const tenant = new Tenant({
      ...tenantData,
      licenseKey,
      licenseType,
      features,
      expirationDate,
    });

    await tenant.save();

    // Create a new database for the tenant
    await dbUtils.switchToTenantDatabase(tenant._id);

    return tenant;
  } catch (error) {
    throw new Error("Error creating tenant: " + error.message);
  }
};

const getAllTenants = async () => {
  try {
    const tenants = await Tenant.find(); // Retrieve all tenants from the database
    return tenants;
  } catch (error) {
    throw new Error("Error fetching tenants: " + error.message);
  }
};

module.exports = {
  createTenant,
  getAllTenants,
};
