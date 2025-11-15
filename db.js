// db.js
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({quiet : true});

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'queuectl';

if (!uri) {
  console.error("Error: MONGODB_URI is not set.");
  process.exit(1);
}

let client;
let db; // This variable will hold our connection

async function connectToDb() {
  if (db) {
    return db; // Return existing connection
  }

  try {
    client = new MongoClient(uri);
    
    await client.connect();
    db = client.db(dbName); // --- Assign the connection here ---

    return db;
  
  } catch (e) {
    console.error("Failed to connect to MongoDB", e);
    process.exit(1);
  }
}

// --- THIS IS THE NEW FUNCTION ---
function getDb() {
  if (!db) {
    // This should never happen if main() calls connectToDb() first
    throw new Error('Database not connected. Call connectToDb() first.');
  }
  return db;
}
// --- END NEW FUNCTION ---

// Export both functions
module.exports = { connectToDb, getDb };