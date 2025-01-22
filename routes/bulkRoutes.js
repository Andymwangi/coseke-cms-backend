const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require('fs-extra');
const path = require('path');
const AllContracts = require('../models/AllContracts');
const roleMiddleware = require('../middleware/roleMiddleware');
const { extractMetadataFromXML, generateFileHash, parseDate } = require('../utils/bulkUtils');
const {
  ensureFoldersExist,
  getContractDocument,
  submitBulkContracts,
  submitManualContract,
  getExpiringContracts,
  getAllContracts,
  getContractById,
  updateContract,
  deleteContract
} = require("../controllers/bulkController");
const auth = require("../middleware/authMiddleware");
const { auditTrail } = require('../middleware/auditMiddleware');
const { encryptionMiddleware, decryptionMiddleware } = require('../middleware/EncryptionDecryptionMiddleware');


// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: "uploads/bulk",
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const uploadMiddleware = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

// Multer setup for manual contracts
const manualStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/manual");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const manualUploadMiddleware = multer({
  storage: manualStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

// Middleware to ensure folders exist before processing requests
router.use((req, res, next) => {
  console.log("Ensuring folders exist...");
  ensureFoldersExist(req, res, next);
});

// Endpoint to submit bulk contracts via file upload
router.post(
  "/submit-bulk-contracts",
  uploadMiddleware.array("contracts"),
  (req, res, next) => {
    console.log("Auth middleware...");
    auth(req, res, next);
  },
  (req, res, next) => {
    console.log("Encryption middleware...");
    encryptionMiddleware(req, res, next);
  },
  (req, res, next) => {
    console.log("Audit trail middleware...");
    auditTrail(req, res, next);
  },
  (req, res, next) => {
    console.log("Submitting bulk contracts...");
    submitBulkContracts(req, res, next);
  }
);

// Endpoint to submit manually entered contract with PDF files
router.post(
  "/submit-manual-contract",
  manualUploadMiddleware.array("contracts"),
  (req, res, next) => {
    console.log("Auth middleware...");
    auth(req, res, next);
  },
  (req, res, next) => {
    console.log("Encryption middleware...");
    encryptionMiddleware(req, res, next);
  },
  (req, res, next) => {
    console.log("Audit trail middleware...");
    auditTrail(req, res, next);
  },
  (req, res, next) => {
    console.log("Submitting manual contract...");
    submitManualContract(req, res, next);
  }
);

// Endpoint to get all contracts
router.get("/contracts", (req, res, next) => {
  console.log("Auth middleware...");
  auth(req, res, next);
}, (req, res, next) => {
  console.log("Getting all contracts...");
  getAllContracts(req, res, next);
});

// Endpoint to get contract by ID
router.get("/contracts/:id", (req, res, next) => {
  console.log("Auth middleware...");
  auth(req, res, next);
}, (req, res, next) => {
  console.log("Getting contract by ID...");
  getContractById(req, res, next);
});

// Endpoint to update contract by ID - Only accessible by admin
router.put(
  "/contracts/:id",
  (req, res, next) => {
    console.log("Auth middleware...");
    auth(req, res, next);
  },
  roleMiddleware(['admin']),
  (req, res, next) => {
    console.log("Updating contract...");
    updateContract(req, res, next);
  }
);

// Endpoint to delete contract by ID - Only accessible by admin
router.delete(
  "/contracts/:id",
  (req, res, next) => {
    console.log("Auth middleware...");
    auth(req, res, next);
  },
  roleMiddleware(['admin']),
  (req, res, next) => {
    console.log("Deleting contract...");
    deleteContract(req, res, next);
  }
);

// Endpoint to get contract document by ID
router.get("/contracts/:id/document", (req, res, next) => {
  console.log("Auth middleware...");
  auth(req, res, next);
},
(req, res, next) => {
  console.log("Decryption middleware...");
  decryptionMiddleware(req, res, next);
},
(req, res, next) => {
  console.log("Getting contract document by ID...");
  getContractDocument(req, res, next);
});

// Endpoint to get expiring contracts
router.get("/expiring-contracts", (req, res, next) => {
  console.log("Auth middleware...");
  auth(req, res, next);
}, (req, res, next) => {
  console.log("Getting expiring contracts...");
  getExpiringContracts(req, res, next);
});

module.exports = router;
