const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  licenseKey: { type: String, required: true, unique: true },
  licenseType: { type: String, enum: ['Free', 'Pro', 'Enterprise'], default: 'Free' },
  expirationDate: { type: Date },
  features: { type: [String], default: [] }, // List of features enabled by the license
}, {
  timestamps: true, // Adds `createdAt` and `updatedAt` fields
});

module.exports = mongoose.model('Tenant', tenantSchema);
