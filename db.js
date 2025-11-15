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
let db; 

async function connectToDb() {
  if (db) {
    return db; 
  }

  try {
    client = new MongoClient(uri);
    
    await client.connect();
    db = client.db(dbName); 

    return db;
  
  } catch (e) {
    console.error("Failed to connect to MongoDB", e);
    process.exit(1);
  }
}

function getDb() {
  if (!db) {
   
    throw new Error('Database not connected. Call connectToDb() first.');
  }
  return db;
}

module.exports = { connectToDb, getDb };