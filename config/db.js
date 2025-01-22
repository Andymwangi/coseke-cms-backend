const mongoose = require('mongoose');

// Store the connection to avoid multiple connections
let isConnected = false;

const connectDB = async (dbName) => {
  if (isConnected) {
    console.log(`Already connected to ${dbName} database`);
    return;
  }

  const dbURI = `mongodb://localhost:27017/${dbName}`;
  
  try {
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log(`Connected to ${dbName} database`);
  } catch (error) {
    console.error(`Error connecting to ${dbName}: `, error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
