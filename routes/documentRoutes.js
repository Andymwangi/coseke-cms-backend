const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const documentController = require("../controllers/documentController");

// Route to create a new document
router.post("/create-doc", authMiddleware, documentController.createDocument);

// Route to get documents created by the authenticated user with pagination
router.get('/my-documents', authMiddleware, documentController.getMyDocuments);

// Route to share a document with collaborators
router.put("/:id/share", authMiddleware, documentController.shareDocument);

// Route to get a specific document
router.get("/:id", authMiddleware, documentController.getDocumentById);

// Route to update a specific document
router.put("/:id", authMiddleware, documentController.updateDocumentById);


router.delete('/delete/:id', authMiddleware, documentController.deleteDocument);

module.exports = router;
