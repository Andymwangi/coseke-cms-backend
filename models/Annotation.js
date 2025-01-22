const mongoose = require("mongoose");

const AnnotationSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    id: {
      type: String,
      required: true,
      unique: true,
    },
    text: {
      type: String,
      required: true,
    },
    range: {
      index: Number,
      length: Number,
    },
    commentedText: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Create a compound index for faster queries
AnnotationSchema.index({ documentId: 1, id: 1 });

module.exports = mongoose.model("Annotation", AnnotationSchema);