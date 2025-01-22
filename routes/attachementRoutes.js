const express = require("express");
const router = express.Router();
const attachmentsController = require("../controllers/attachmentsController");
const { encryptionMiddleware, decryptionMiddleware } = require('../middleware/EncryptionDecryptionMiddleware');

// Endpoint to upload attachments
router.post("/contracts/:id/attachments", encryptionMiddleware, attachmentsController.uploadAttachment);

// Endpoint to fetch attachments for a specific contract
router.get("/contracts/:id/attachments", attachmentsController.getAttachments);

// Endpoint to fetch and serve the file
router.get("/contracts/:id/attachments/:fileName",decryptionMiddleware, attachmentsController.downloadAttachment);

module.exports = router;
