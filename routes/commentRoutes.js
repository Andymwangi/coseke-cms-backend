// routes/commentRoutes.js
const express = require("express");
const { addComment, getComments } = require("../controllers/commentController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create", authMiddleware, addComment);
router.get("/get/:documentId", authMiddleware, getComments);

module.exports = router;
