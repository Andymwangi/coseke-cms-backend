const fs = require("fs-extra");
const crypto = require("crypto");
const { DOMParser } = require("xmldom");

async function extractMetadataFromXML(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const commonFields = [
      "Contract Number",
      "Contract Description",
      "Parties",
      "Start Date",
      "End Date",
      "Section Or Department",
      "Term",
      "Station Name",
      "Station Dealer",
      "Image count in document",
    ];
    const fields = xmlDoc.getElementsByTagName("field");
    const metadata = {};

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const name = field.getAttribute("name");
      const value = field.getAttribute("value");
      if (commonFields.includes(name)) {
        metadata[name] = value;
      } else {
        if (!metadata[name]) {
          metadata[name] = [];
        }
        metadata[name].push(value);
      }
    }
    return metadata;
  } catch (error) {
    console.error("Error extracting metadata from XML:", error);
    throw error;
  }
}

async function generateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

function parseDate(dateString) {
  const parts = dateString.split("-");
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

module.exports = {
  extractMetadataFromXML,
  generateFileHash,
  parseDate,
};
