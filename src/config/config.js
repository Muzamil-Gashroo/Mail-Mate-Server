require('dotenv').config();

const mongoose = require("mongoose");

const connectDB = async () => {

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }

};

const config = {

  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
  TRACKING_BASE_URL: process.env.NGROK_URL,

};

module.exports = { connectDB, config };