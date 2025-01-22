const mongoose = require('mongoose');

// Define the schema for the AuditLog collection/table
const auditLogSchema = new mongoose.Schema(
  {
    method: String,
    url: String,
    params: Object,
    body: Object,
    user: Object,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "audit_logs" } // Optional: Specify the collection name
);

// Create the AuditLog model
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

// Export the AuditLog model
module.exports = AuditLog;
