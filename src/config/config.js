require('dotenv').config();

const mongoose = require("mongoose");

const connectDB = async () => {

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gmail-client');
    console.log('DB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }

};

const config = {

  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI || "http://localhost:5000/auth/google/callback",
  TRACKING_BASE_URL: process.env.NGROK_URL || "http://localhost:5000"

};

module.exports = { connectDB, config };