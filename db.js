// db.js
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://burhan:burhan786@cluster0.wqsbuod.mongodb.net/"; // Your MongoDB connection string
const dbName = "queuectl";
let client;
let db;

async function connectToDb() {
  if (db) {
    return db;
  }
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log("Connected to MongoDB");
  return db;
}

// connectToDb();

module.exports = { connectToDb };