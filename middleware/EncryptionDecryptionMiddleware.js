const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const stream = require("stream");
const util = require("util");

const pipeline = util.promisify(stream.pipeline);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16
const MAGIC_BYTES = "ENCFILE"; // Magic bytes to identify our custom format

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

function encrypt(buffer) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt file: " + error.message);
  }
}

function decrypt(encrypted) {
  try {
    const iv = encrypted.slice(0, IV_LENGTH);
    const encryptedContent = encrypted.slice(IV_LENGTH);
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    return Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt file: " + error.message);
  }
}
async function encryptStream(inputPath, outputPath) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  // Write IV to the output file first
  const output = fs.createWriteStream(outputPath);
  output.write(iv);

  await pipeline(fs.createReadStream(inputPath), cipher, output);
}

async function decryptStream(inputPath, outputPath) {
  const fd = await fs.promises.open(inputPath, "r");
  const iv = Buffer.alloc(IV_LENGTH);
  await fd.read(iv, 0, IV_LENGTH, 0);
  await fd.close();

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  await pipeline(
    fs.createReadStream(inputPath, { start: IV_LENGTH }),
    decipher,
    fs.createWriteStream(outputPath)
  );
}

async function decryptStream(inputPath, outputPath) {
  const fd = await fs.promises.open(inputPath, "r");
  const iv = Buffer.alloc(IV_LENGTH);
  await fd.read(iv, 0, IV_LENGTH, 0);
  await fd.close();

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  await pipeline(
    fs.createReadStream(inputPath, { start: IV_LENGTH }),
    decipher,
    fs.createWriteStream(outputPath)
  );
}

function encryptFile(buffer, originalExt) {
  const encryptedContent = encrypt(buffer);
  const magicBuffer = Buffer.from(MAGIC_BYTES);
  const extBuffer = Buffer.from(originalExt.padEnd(4)); // Pad extension to 4 bytes
  return Buffer.concat([magicBuffer, extBuffer, encryptedContent]);
}

function decryptFile(buffer) {
  const magicBytes = buffer.slice(0, MAGIC_BYTES.length).toString();
  if (magicBytes !== MAGIC_BYTES) {
    console.log("File is not encrypted, returning as is");
    return { content: buffer, ext: "" };
  }
  const ext = buffer
    .slice(MAGIC_BYTES.length, MAGIC_BYTES.length + 4)
    .toString()
    .trim();
  const encryptedContent = buffer.slice(MAGIC_BYTES.length + 4);
  const decryptedContent = decrypt(encryptedContent);
  return { content: decryptedContent, ext };
}

const encryptionMiddleware = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const processFile = async (file) => {
    const originalExt = path.extname(file.originalname).toLowerCase();

    if (ENCRYPT_EXTENSIONS.includes(originalExt)) {
      try {
        console.log(`Encrypting file: ${file.originalname}`);
        if (originalExt === ".docx" || originalExt === ".doc") {
          const tempEncryptedPath = `${file.path}.enc`;
          await encryptStream(file.path, tempEncryptedPath);
          fs.renameSync(tempEncryptedPath, file.path);
        } else {
          const fileBuffer = fs.readFileSync(file.path);
          const encryptedBuffer = encryptFile(fileBuffer, originalExt);
          fs.writeFileSync(file.path, encryptedBuffer);
        }
        file.isEncrypted = true;
        console.log(`File encrypted successfully: ${file.originalname}`);
      } catch (error) {
        console.error(`Error encrypting file ${file.originalname}:`, error);
        file.isEncrypted = false;
      }
    } else {
      console.log(
        `File not encrypted (not in ENCRYPT_EXTENSIONS): ${file.originalname}`
      );
      file.isEncrypted = false;
    }

    file.originalExt = originalExt;
  };

  Promise.all(req.files.map(processFile))
    .then(() => next())
    .catch(next);
};

const decryptionMiddleware = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  console.log(`Attempting to process file: ${req.file.originalname}`);
  const originalExt = path.extname(req.file.originalname).toLowerCase();

  try {
    if (req.file.isEncrypted) {
      if (originalExt === ".docx" || originalExt === ".doc") {
        const tempDecryptedPath = `${req.file.path}.dec`;
        await decryptStream(req.file.path, tempDecryptedPath);
        fs.renameSync(tempDecryptedPath, req.file.path);
      } else {
        const fileBuffer = fs.readFileSync(req.file.path);
        const { content } = decryptFile(fileBuffer);
        fs.writeFileSync(req.file.path, content);
      }
      req.file.isEncrypted = false;
    }
    console.log(`File processed successfully: ${req.file.originalname}`);
  } catch (error) {
    console.error(`Error processing file ${req.file.originalname}:`, error);
    return res
      .status(500)
      .json({ error: "Failed to process file: " + error.message });
  }

  next();
};

module.exports = {
  encryptionMiddleware,
  decryptionMiddleware,
  encryptFile,
  decryptFile,
  encryptStream,
  decryptStream,
};
