const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  generatePDFReport,
  generateExcelReport,
} = require("../controllers/reportsController");

// Endpoint to download contracts report in PDF format - Only accessible by admin
router.get(
  "/contracts/pdf",
  (req, res, next) => {
    console.log("Auth middleware for PDF report...");
    auth(req, res, next);
  },
  roleMiddleware(["admin"]),
  (req, res, next) => {
    console.log("Generating PDF report...");
    generatePDFReport(req, res, next);
  }
);

// Endpoint to download contracts report in Excel format - Only accessible by admin
router.get(
  "/contracts/excel",
  (req, res, next) => {
    console.log("Auth middleware for Excel report...");
    auth(req, res, next);
  },
  roleMiddleware(["admin"]),
  (req, res, next) => {
    console.log("Generating Excel report...");
    generateExcelReport(req, res, next);
  }
);

module.exports = router;
