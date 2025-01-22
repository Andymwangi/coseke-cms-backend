const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");
const os = require("os");
const crypto = require("crypto");
const AllContracts = require("../models/AllContracts");
const {
  extractMetadataFromXML,
  generateFileHash,
  parseDate,
} = require("../utils/bulkUtils");
const { decryptFile } = require("../middleware/EncryptionDecryptionMiddleware");

// Middleware to ensure folders exist before processing requests
async function ensureFoldersExist(req, res, next) {
  try {
    await fs.ensureDir("uploads/bulk");
    await fs.ensureDir("uploads/manual");
    await fs.ensureDir("processed-pdfs");
    next();
  } catch (error) {
    console.error("Error creating folders:", error);
    res.status(500).json({ message: "Failed to create folders ⛔⛔" });
  }
}

// Submit bulk contracts
async function submitBulkContracts(req, res) {
  try {
    console.log("Starting bulk contract submission...");
    const { category } = req.body;
    const files = req.files;

    if (!category) {
      return res.status(400).json({ message: "Category is required ⛔⛔" });
    }

    console.log(
      `Category: ${category}, Number of files received: ${files.length}`
    );

    const processFile = async (file) => {
      if (path.extname(file.originalname) !== ".xml") {
        return {
          skipped: true,
          fileName: file.originalname,
          reason: "Not an XML file",
        };
      }

      const pdfFileName = file.originalname.replace(".xml", ".pdf");
      const pdfPath = path.join("uploads/bulk", pdfFileName);
      const permanentPdfPath = path.join("processed-pdfs", pdfFileName);

      if (!(await fs.pathExists(pdfPath))) {
        return {
          skipped: true,
          fileName: pdfFileName,
          reason: "Corresponding PDF not found",
        };
      }

      const pdfHash = await generateFileHash(pdfPath);
      const existingContract = await AllContracts.findOne({
        fileHash: pdfHash,
      });

      if (existingContract || (await fs.pathExists(permanentPdfPath))) {
        return {
          skipped: true,
          fileName: pdfFileName,
          reason: "Duplicate file",
        };
      }

      const xmlData = await fs.readFile(file.path, "utf8");
      const metadata = await extractMetadataFromXML(xmlData);

      await fs.move(pdfPath, permanentPdfPath, { overwrite: true });
      const pdfStats = await fs.stat(permanentPdfPath);

      const contractData = {
        ...metadata,
        startDate: parseDate(metadata["Start Date"]),
        endDate: parseDate(metadata["End Date"]),
        pdfPath: permanentPdfPath,
        xmlPath: file.path,
        category,
        fileSize: pdfStats.size,
        fileName: pdfFileName,
        fileHash: pdfHash,
        createdBy: req.user.email,
        company: req.user.company,
      };

      await fs.remove(file.path);
      return { success: true, contractData };
    };

    const results = await Promise.all(files.map(processFile));

    const skippedFiles = results
      .filter((r) => r.skipped)
      .map((r) => `${r.fileName} (${r.reason})`);
    const successfulFiles = results
      .filter((r) => r.success)
      .map((r) => r.contractData);

    if (successfulFiles.length > 0) {
      await AllContracts.insertMany(successfulFiles);
    }

    const responseMessage =
      successfulFiles.length > 0
        ? `Files processed successfully ✅✅. Processed files: ${successfulFiles
            .map((f) => f.fileName)
            .join(", ")}.`
        : "No files were successfully processed.";

    console.log(responseMessage);
    res.status(200).json({
      message: responseMessage,
      skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
      processedCount: successfulFiles.length,
      skippedCount: skippedFiles.length,
    });
  } catch (error) {
    console.error("Error processing files:", error);
    res
      .status(500)
      .json({ message: `An unexpected issue occurred ⛔⛔: ${error.message}` });
  }
}

// Submit manually entered contract
async function submitManualContract(req, res) {
  try {
    const { body: formData, files, user } = req;
    console.log("Manual request:", formData);

    const requiredFields = [
      "category",
      "Contract Number",
      "Parties",
      "startDate",
      "Section Or Department",
      "Term",
      "endDate",
      "Contract Description",
    ];
    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      return res
        .status(400)
        .json({ message: "All fields are required ⛔⛔", missingFields });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "Files are required ⛔⛔" });
    }

    const processedFiles = [];
    const errors = [];

    await Promise.all(
      files.map(async (file) => {
        if (path.extname(file.originalname) !== ".pdf") {
          errors.push(`Skipping non-PDF file: ${file.originalname}`);
          return;
        }

        const pdfFileName = file.originalname;
        const pdfPath = file.path;
        const permanentPdfPath = path.join("processed-pdfs", pdfFileName);

        try {
          const pdfHash = await generateFileHash(pdfPath);
          const existingContract = await AllContracts.findOne({
            fileHash: pdfHash,
          });

          if (existingContract || (await fs.pathExists(permanentPdfPath))) {
            errors.push(`Duplicate file found: ${pdfFileName}`);
          } else {
            processedFiles.push({ file, pdfHash, permanentPdfPath });
          }
        } catch (error) {
          errors.push(`Error processing ${pdfFileName}: ${error.message}`);
        }
      })
    );

    if (processedFiles.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid files to process", errors });
    }

    const createdContracts = await AllContracts.create(
      processedFiles.map(({ file, pdfHash, permanentPdfPath }) => ({
        ...formData,
        pdfPath: permanentPdfPath,
        fileName: file.originalname,
        fileHash: pdfHash,
        createdBy: user.email,
        company: user.company,
      }))
    );

    await Promise.all(
      processedFiles.map(async ({ file, permanentPdfPath }) => {
        await fs.move(file.path, permanentPdfPath, { overwrite: true });
      })
    );

    const successMessage = `Files processed successfully ✅✅. Processed files: ${processedFiles
      .map((pf) => pf.file.originalname)
      .join(", ")}.`;
    console.log(successMessage);

    res.status(200).json({
      message: successMessage,
      errors: errors.length > 0 ? errors : undefined,
      createdContracts: createdContracts.map((c) => c._id),
    });
  } catch (error) {
    console.error("Error processing files:", error);
    res
      .status(500)
      .json({ message: `An unexpected issue occurred ⛔⛔: ${error.message}` });
  }
}

// Fetch all contracts from the db
async function getAllContracts(req, res) {
  try {
    // Find contracts, sort by updatedAt in descending order, and use lean()
    const contracts = await AllContracts.find(req.queryFilter)
      .sort({ updatedAt: -1 }) // Sort by updatedAt in descending order (most recent first)
      .lean();

    res.json(contracts);
  } catch (err) {
    console.error("Error in getAllContracts:", err);
    res.status(500).json({ message: "Server error ⛔⛔", error: err.message });
  }
}

// Get contract by ID
async function getContractById(req, res) {
  try {
    const { id } = req.params;

    // Validate if the id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid contract ID format ⛔⛔" });
    }

    // Use lean() for better performance
    // We're not using select() here to ensure all fields are returned
    const contract = await AllContracts.findById(id)
      .populate("renewedFrom", "category status") // Populate minimal info from renewedFrom
      .lean();

    if (!contract) {
      return res.status(404).json({ msg: "Contract not found ⛔⛔" });
    }

    res.json(contract);
  } catch (err) {
    console.error("Error in getContractById:", err.message);
    res.status(500).json({ msg: "Server error ⛔⛔" });
  }
}

// Update contract by ID
async function updateContract(req, res) {
  const { id } = req.params;
  const updateFields = req.body;
  console.log("Contract update data:", updateFields);

  try {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid contract ID" });
    }

    // Check if the contract exists
    let contract = await AllContracts.findById(id);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found ⛔⛔" });
    }

    // List of fields that can be updated
    const allowedFields = [
      "Contract Number",
      "Parties",
      "startDate",
      "endDate",
      "status",
      "category",
      "Section Or Department",
      "Contract Description",
      "renewal",
      "Term",
      "clientName",
      "clientAddress",
      "clientPostalCode",
      "clientLocation",
      "clientPhone",
      "clientEmail",
      "paymentTerm",
      "contractAmount"
    ];

    // Prepare update object with only allowed fields
    const update = {};
    for (const field of allowedFields) {
      if (updateFields.hasOwnProperty(field)) {
        // Special handling for date fields
        if (["startDate", "endDate"].includes(field)) {
          update[field] = new Date(updateFields[field]);
        } 
        // Special handling for renewal (convert to boolean)
        else if (field === "renewal") {
          update[field] = updateFields[field] === "true";
        }
        // Special handling for contract amount (convert to number)
        else if (field === "contractAmount") {
          update[field] = Number(updateFields[field]);
        }
        else {
          update[field] = updateFields[field];
        }
      }
    }

    // Add metadata
    update.updatedAt = new Date();
    update.updatedBy = req.user.email;

    // Update the contract
    contract = await AllContracts.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!contract) {
      return res
        .status(404)
        .json({ message: "Contract not found after update ⛔⛔" });
    }

    res.json({ message: "Contract updated successfully ✅", contract });
  } catch (err) {
    console.error("Error updating contract:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    if (err.name === 'MongoError' && err.code === 11000) {
      return res.status(400).json({ message: "Duplicate key error" });
    }
    res.status(500).json({ message: "Server error ⛔⛔", error: err.message });
  }
}

// Delete contract by ID
async function deleteContract(req, res) {
  try {
    let contract = await AllContracts.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ msg: "Contract not found ⛔⛔" });
    }

    await AllContracts.findByIdAndDelete(req.params.id);

    res.json({ message: "Contract deleted successfully ✅" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error ⛔⛔");
  }
}

async function getContractDocument(req, res) {
  let tempFilePath = null;
  try {
    // Find the contract by ID
    const contract = await AllContracts.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ msg: "Contract not found ⛔⛔" });
    }

    // Get the file path from the contract
    const filePath = contract.pdfPath;
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ msg: "Contract file not found ⛔⛔" });
    }

    // Read the file
    const fileBuffer = await fs.readFile(filePath);

    let finalBuffer;
    let ext = path.extname(contract.fileName);

    // Check if the file is encrypted
    const magicBytes = fileBuffer.slice(0, 7).toString(); // "ENCFILE"
    if (magicBytes === "ENCFILE") {
      console.log(`File is encrypted. Attempting to decrypt...`);
      try {
        const decryptedData = decryptFile(fileBuffer);
        finalBuffer = decryptedData.content;
        ext = decryptedData.ext || ext;
        console.log(`File decrypted successfully.`);
      } catch (decryptError) {
        console.error("Error decrypting file:", decryptError);
        return res.status(500).json({ msg: "Error decrypting file ⛔⛔" });
      }
    } else {
      console.log(`File is not encrypted.`);
      finalBuffer = fileBuffer;
    }

    // Create a temporary file with the content
    const tempFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    await fs.writeFile(tempFilePath, finalBuffer);

    // Serve the file
    res.download(tempFilePath, contract.fileName, (err) => {
      if (err) {
        console.error("Error serving file:", err);
        if (!res.headersSent) {
          res.status(500).json({ msg: "Error serving file ⛔⛔" });
        }
      }
      // Delete the temporary file after it has been sent
      deleteTempFile(tempFilePath);
    });
  } catch (err) {
    console.error("Error in getContractDocument:", err);
    if (!res.headersSent) {
      res.status(500).send("Server error ⛔⛔");
    }
    // If an error occurred, attempt to delete the temp file
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }
  }
}

function deleteTempFile(filePath) {
  fs.unlink(filePath)
    .then(() => console.log(`Temporary file deleted: ${filePath}`))
    .catch((err) => {
      if (err.code !== "ENOENT") {
        console.error(`Error deleting temp file: ${filePath}`, err);
      }
    });
}

function deleteTempFile(filePath) {
  fs.unlink(filePath)
    .then(() => console.log(`Temporary file deleted: ${filePath}`))
    .catch((err) => {
      if (err.code !== "ENOENT") {
        console.error(`Error deleting temp file: ${filePath}`, err);
      }
    });
}

async function getExpiringContracts(req, res) {
  try {
    const today = new Date();
    const ninetyDaysFromNow = new Date(
      today.getTime() + 90 * 24 * 60 * 60 * 1000
    );

    const pipeline = [
      {
        $match: {
          ...req.queryFilter,
          $or: [
            { endDate: { $gte: today, $lte: ninetyDaysFromNow } },
            { "End Date": { $gte: today, $lte: ninetyDaysFromNow } },
          ],
        },
      },
      {
        $addFields: {
          effectiveEndDate: { $ifNull: ["$endDate", "$End Date"] },
          daysRemaining: {
            $ceil: {
              $divide: [
                { $subtract: [{ $ifNull: ["$endDate", "$End Date"] }, today] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
      {
        $match: {
          daysRemaining: { $gte: 0, $lte: 90 },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ["$daysRemaining", 0] }, then: 0 },
                { case: { $eq: ["$daysRemaining", 1] }, then: 1 },
                { case: { $lte: ["$daysRemaining", 7] }, then: 7 },
                { case: { $lte: ["$daysRemaining", 30] }, then: 30 },
                { case: { $lte: ["$daysRemaining", 90] }, then: 90 },
              ],
              default: "other",
            },
          },
          contracts: {
            $push: {
              contractNumber: {
                $ifNull: ["$Contract Number", "$contractNumber"],
              },
              contractDescription: {
                $ifNull: ["$Contract Description", "$contractDescription"],
              },
              endDate: "$effectiveEndDate",
              daysRemaining: "$daysRemaining",
              category: "$category",
              status: "$status",
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ];

    const expiringContracts = await AllContracts.aggregate(pipeline);

    const reminderMessages = expiringContracts.map((group) => ({
      daysRemaining: group._id,
      contracts: group.contracts,
    }));

    res.json({ reminderMessages });
  } catch (error) {
    console.error("Error fetching and organizing expiring contracts:", error);
    res.status(500).json({ message: "Server error ⛔⛔" });
  }
}

module.exports = {
  ensureFoldersExist,
  submitBulkContracts,
  submitManualContract,
  getExpiringContracts,
  getAllContracts,
  getContractById,
  getContractDocument,
  updateContract,
  deleteContract,
};
