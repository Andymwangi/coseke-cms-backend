const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Database configuration
const SOURCE_DB_URI = 'mongodb://localhost:27017/undefined';
const EXPORT_DIR = './db-export';

async function exportDatabase() {
  try {
    // Create export directory
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    console.log('Connecting to source database...');
    await mongoose.connect(SOURCE_DB_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections to export\n`);

    // Export each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`Exporting collection: ${collectionName}...`);

      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();

      // Save to JSON file
      const filePath = path.join(EXPORT_DIR, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));

      console.log(`  ✓ Exported ${documents.length} documents to ${filePath}`);
    }

    // Save database metadata
    const metadata = {
      databaseName: 'undefined',
      exportDate: new Date().toISOString(),
      collections: collections.map(c => c.name),
      totalCollections: collections.length
    };

    fs.writeFileSync(
      path.join(EXPORT_DIR, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('\n✅ Database export completed successfully!');
    console.log(`📁 Export location: ${path.resolve(EXPORT_DIR)}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error exporting database:', error);
    process.exit(1);
  }
}

exportDatabase();
