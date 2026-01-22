const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Database configuration
// UPDATE THIS WITH YOUR CLOUD DATABASE URI
const TARGET_DB_URI = process.env.CLOUD_MONGO_URI || 'mongodb://your-cloud-server:27017/undefined';
const IMPORT_DIR = './db-export';

async function importDatabase() {
  try {
    // Check if export directory exists
    if (!fs.existsSync(IMPORT_DIR)) {
      throw new Error(`Export directory not found: ${IMPORT_DIR}`);
    }

    // Read metadata
    const metadataPath = path.join(IMPORT_DIR, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Metadata file not found. Please run exportDatabase.js first.');
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log(`\nImporting database: ${metadata.databaseName}`);
    console.log(`Export date: ${metadata.exportDate}`);
    console.log(`Collections to import: ${metadata.totalCollections}\n`);

    console.log('Connecting to target database...');
    await mongoose.connect(TARGET_DB_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;

    // Import each collection
    for (const collectionName of metadata.collections) {
      const filePath = path.join(IMPORT_DIR, `${collectionName}.json`);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${collectionName} - file not found`);
        continue;
      }

      console.log(`Importing collection: ${collectionName}...`);

      const documents = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (documents.length === 0) {
        console.log(`  ℹ️  Collection ${collectionName} is empty, skipping...`);
        continue;
      }

      const collection = db.collection(collectionName);

      // Clear existing data (optional - comment out if you want to merge)
      await collection.deleteMany({});

      // Insert documents
      await collection.insertMany(documents);

      console.log(`  ✓ Imported ${documents.length} documents`);
    }

    console.log('\n✅ Database import completed successfully!');
    console.log(`📊 Imported ${metadata.totalCollections} collections`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error importing database:', error);
    process.exit(1);
  }
}

importDatabase();
