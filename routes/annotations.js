const express = require("express");
const router = express.Router();
const Annotation = require("../models/Annotation");
const Document = require("../models/Document");
const auth = require("../middleware/authMiddleware");

// Save or update annotations for a document
router.post("/documents/:documentId/annotations", auth, async (req, res) => {
  try {
    const { annotations } = req.body;
    const documentId = req.params.documentId;

    // Check if the user has access to the document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: "Document not found ⛔⛔" });
    }
    if (
      document.user.toString() !== req.user.id &&
      !document.collaborators.includes(req.user.id)
    ) {
      return res.status(403).json({ message: "Access denied ⛔⛔" });
    }

    const savedAnnotations = await Promise.all(
      annotations.map(async (annotation) => {
        if (annotation.id) {
          // Update existing annotation
          const existingAnnotation = await Annotation.findOne({ id: annotation.id, documentId });
          if (existingAnnotation) {
            existingAnnotation.text = annotation.text;
            existingAnnotation.range = annotation.range;
            existingAnnotation.commentedText = annotation.commentedText;
            await existingAnnotation.save();
            return existingAnnotation;
          }
        }
        
        // Create new annotation
        const newAnnotation = new Annotation({
          ...annotation,
          documentId,
          userId: req.user.id,
        });
        await newAnnotation.save();
        return newAnnotation;
      })
    );

    res.status(201).json(savedAnnotations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all annotations for a document
router.get("/documents/:documentId/annotations", auth, async (req, res) => {
  try {
    const annotations = await Annotation.find({
      documentId: req.params.documentId,
    }).populate('userId', 'firstname lastname email'); // Populate user information

    res.json(annotations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete an annotation
router.delete("/documents/:documentId/annotations/:annotationId", auth, async (req, res) => {
  try {
    const { documentId, annotationId } = req.params;

    const annotation = await Annotation.findOneAndDelete({ id: annotationId, documentId });

    if (!annotation) {
      return res.status(404).json({ message: "Annotation not found ⛔⛔" });
    }

    res.json({ message: "Annotation deleted successfully ✅✅" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;