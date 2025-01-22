const Document = require("../models/Document");

// Create a new document
exports.createDocument = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ msg: "Title is required" });
    }

    const newDocument = new Document({
      data: {},
      user: req.user.id,
      title: title,
    });

    await newDocument.save();

    res.status(201).json(newDocument);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
};

// Get documents created by the authenticated user with pagination and search
exports.getMyDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    // Construct the search query
    const searchQuery = search
      ? {
          $or: [
            { title: { $regex: search, $options: "i" } }, // Search by title
            // Add more fields to search if needed
          ],
        }
      : {};

    // Find documents with search, pagination, and user filter
    const documents = await Document.find({
      $or: [{ user: userId }, { collaborators: userId }],
      ...searchQuery,
    })
      .populate("collaborators", "firstname lastname")
      .populate("user", "firstname lastname")
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 }); // Optional: Sort by updatedAt in descending order

    // Count total documents matching the query
    const totalDocuments = await Document.countDocuments({
      $or: [{ user: userId }, { collaborators: userId }],
      ...searchQuery,
    });

    res.json({
      documents,
      pagination: {
        totalDocuments,
        totalPages: Math.ceil(totalDocuments / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching documents:", error.message);
    res.status(500).send("Server Error");
  }
};

// Share a document with collaborators
exports.shareDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) return res.status(404).json({ msg: "Document not found" });

    if (document.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    const { collaborators } = req.body;
    document.collaborators = collaborators;

    await document.save();

    res.json(document);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
};

// Get a specific document
exports.getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ msg: "Document not found" });
    res.json(document);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
};

// Update a specific document
exports.updateDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ msg: "Document not found" });

    if (
      document.user.toString() !== req.user.id &&
      !document.collaborators.includes(req.user.id)
    ) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    const updatedDocument = await Document.findByIdAndUpdate(
      req.params.id,
      { data: req.body.data },
      { new: true }
    );

    res.json(updatedDocument);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
};

// Delete a specific document
exports.deleteDocument = async (req, res) => {
  try {
    console.log(`Attempting to delete document with ID: ${req.params.id}`);
    console.log(`User ID from request: ${req.user.id}`);

    const document = await Document.findById(req.params.id);

    if (!document) {
      console.log(`Document not found with ID: ${req.params.id}`);
      return res.status(404).json({ msg: "Document not found ⛔⛔" });
    }

    console.log(`Document found. Owner ID: ${document.user.toString()}`);

    // Check if the user is the owner of the document
    if (document.user.toString() !== req.user.id) {
      console.log(
        `User ${req.user.id} is not authorized to delete document ${req.params.id}`
      );
      return res
        .status(401)
        .json({
          msg: "Oopsie! you can only delete a document you created! ⛔⛔",
        });
    }

    console.log(`Attempting to remove document with ID: ${req.params.id}`);
    const result = await Document.findByIdAndDelete(req.params.id);

    if (!result) {
      console.log(`Failed to delete document with ID: ${req.params.id}`);
      return res
        .status(500)
        .json({ msg: "Failed to delete the document. Please try again." });
    }

    console.log(`Successfully deleted document with ID: ${req.params.id}`);
    res.json({ msg: "Document deleted successfully ✅✅" });
  } catch (error) {
    console.error("Error in deleteDocument:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      msg: "Server Error",
      error: error.message,
    });
  }
};
