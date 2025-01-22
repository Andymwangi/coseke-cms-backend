// controllers/commentController.js
const Comment = require("../models/Comments");

exports.addComment = async (req, res) => {
  try {
    const { documentId, content, parentCommentId } = req.body;
    const comment = new Comment({
      documentId,
      userId: req.user.id,
      content,
      parentCommentId,
    });
    await comment.save();
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment." });
  }
};

exports.getComments = async (req, res) => {
  try {
    const { documentId } = req.params;
    const comments = await Comment.find({ documentId }).populate("userId", "firstname lastname");
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve comments." });
  }
};
