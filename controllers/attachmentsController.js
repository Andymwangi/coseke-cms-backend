const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const fsPromises = require("fs").promises;
const AllContracts = require("../models/AllContracts");
const {
  encryptFile,
  decryptFile,
  encryptStream,
  decryptStream,
} = require("../middleware/EncryptionDecryptionMiddleware");

// List of file extensions to encrypt
const ENCRYPT_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
];

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "contract-attachments");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

// Middleware to ensure folders exist
const ensureFoldersExist = require("../middleware/ensureFoldersExist");

exports.uploadAttachment = [
  ensureFoldersExist,
  upload.single("attachment"),
  async (req, res) => {
    try {
      const contractId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log(
        `Uploading attachment: ${file.originalname} for contract: ${contractId}`
      );

      const contract = await AllContracts.findById(contractId);
      if (!contract) {
        console.log(`Contract not found: ${contractId}`);
        return res.status(404).json({ message: "Contract not found" });
      }

      const originalExt = path.extname(file.originalname).toLowerCase();
      let isEncrypted = false;

      if (ENCRYPT_EXTENSIONS.includes(originalExt)) {
        console.log(`Encrypting file: ${file.originalname}`);
        try {
          let encryptedFilePath = `${file.path}.enc`;

          // Encrypt the file
          if (originalExt === ".docx" || originalExt === ".doc") {
            await encryptStream(file.path, encryptedFilePath);
          } else {
            const fileBuffer = await fsPromises.readFile(file.path);
            const encryptedBuffer = encryptFile(fileBuffer, originalExt);
            await fsPromises.writeFile(encryptedFilePath, encryptedBuffer);
          }

          // Ensure the original file is removed and replaced with the encrypted file
          await fsPromises.unlink(file.path); // Delete the original unencrypted file
          await fsPromises.rename(encryptedFilePath, file.path); // Rename encrypted file to original name

          isEncrypted = true;
          console.log(`File encrypted successfully: ${file.originalname}`);
        } catch (encryptError) {
          console.error(
            `Error encrypting file ${file.originalname}:`,
            encryptError
          );
          // If encryption fails, handle it appropriately
          isEncrypted = false;
        }
      } else {
        console.log(
          `File not encrypted (not in ENCRYPT_EXTENSIONS): ${file.originalname}`
        );
      }

      contract.attachments.push({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        isEncrypted: isEncrypted,
      });

      await contract.save();
      console.log(`Attachment uploaded successfully: ${file.originalname}`);
      res
        .status(200)
        .json({ message: "Attachment uploaded successfully", contract });
    } catch (error) {
      console.error("Error in uploadAttachment:", error);
      res
        .status(500)
        .json({ message: "Failed to upload attachment", error: error.message });
    }
  },
];

exports.getAttachments = async (req, res) => {
  try {
    const contractId = req.params.id;
    console.log(`Fetching attachments for contract: ${contractId}`);
    const contract = await AllContracts.findById(contractId);
    if (!contract) {
      console.log(`Contract not found: ${contractId}`);
      return res.status(404).json({ message: "Contract not found" });
    }
    console.log(`Attachments fetched successfully for contract: ${contractId}`);
    res.status(200).json({ attachments: contract.attachments });
  } catch (error) {
    console.error("Error in getAttachments:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch attachments", error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  let tempFilePath = null;
  try {
    const contractId = req.params.id;
    const fileName = req.params.fileName;

    console.log(
      `Attempting to download file: ${fileName} for contract: ${contractId}`
    );

    const contract = await AllContracts.findById(contractId);
    if (!contract) {
      console.log(`Contract not found: ${contractId}`);
      return res.status(404).json({ message: "Contract not found" });
    }

    const attachment = contract.attachments.find((att) =>
      att.filePath.includes(fileName)
    );
    if (!attachment) {
      console.log(`Attachment not found: ${fileName}`);
      return res.status(404).json({ message: "Attachment not found" });
    }

    const filePath = path.resolve(__dirname, "..", attachment.filePath);

    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
    } catch (error) {
      console.log(`File not found on server: ${filePath}`);
      return res.status(404).json({ message: "File not found on server" });
    }

    console.log(`Processing file: ${filePath}`);

    const originalExt = path.extname(fileName).toLowerCase();
    let finalBuffer;

    if (attachment.isEncrypted) {
      console.log(`File is encrypted. Attempting to decrypt...`);
      try {
        if (originalExt === ".docx" || originalExt === ".doc") {
          const tempDecryptedPath = `${filePath}.dec`;
          await decryptStream(filePath, tempDecryptedPath);
          finalBuffer = await fsPromises.readFile(tempDecryptedPath);
          await fsPromises.unlink(tempDecryptedPath); // Delete the temporary decrypted file
        } else {
          const fileBuffer = await fsPromises.readFile(filePath);
          const { content } = decryptFile(fileBuffer);
          finalBuffer = content;
        }
        console.log(`File decrypted successfully.`);
      } catch (decryptError) {
        console.error(`Error decrypting file: ${decryptError.message}`);
        return res.status(500).json({
          message: "Failed to decrypt file",
          error: decryptError.message,
        });
      }
    } else {
      console.log(`File is not encrypted.`);
      finalBuffer = await fsPromises.readFile(filePath);
    }

    // Create a temporary file with the content
    const tempFileName = `${crypto
      .randomBytes(16)
      .toString("hex")}${originalExt}`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    await fsPromises.writeFile(tempFilePath, finalBuffer);

    const mimeType = getMimeType(originalExt);
    console.log(`MIME type determined: ${mimeType}`);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${encodeURIComponent(fileName)}`
    );
    res.setHeader("Content-Type", mimeType);

    // Use res.download to serve the file
    res.download(tempFilePath, fileName, (err) => {
      if (err) {
        console.error(`Error serving file: ${err.message}`);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ message: "Error serving file", error: err.message });
        }
      }
      // Delete the temporary file after it has been sent or if an error occurred
      deleteTempFile(tempFilePath);
    });

    console.log(`File download initiated: ${fileName}`);
  } catch (error) {
    console.error("Error in downloadAttachment:", error);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Failed to download attachment",
        error: error.message,
      });
    }
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }
  }
};

function deleteTempFile(filePath) {
  fsPromises
    .unlink(filePath)
    .then(() => console.log(`Temporary file deleted: ${filePath}`))
    .catch((err) =>
      console.error(`Error deleting temporary file: ${filePath}`, err)
    );
}

function getMimeType(ext) {
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv",
  };
  return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
}
