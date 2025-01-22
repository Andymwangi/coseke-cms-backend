const AuditLog = require("../models/AuditLog");

// Controller method to fetch all audit logs
const getAllLogs = async (req, res) => {
  try {
    // Fetch all audit logs, sorted by createdAt descending
    const logs = await AuditLog.find().sort({ createdAt: -1 });
    console.log('Logs for the current company;', logs)
    res.status(200).json(logs); // Respond with JSON array of audit logs
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs 🚫🚫" }); // Handle error response
  }
};

module.exports = {
  getAllLogs,
};
