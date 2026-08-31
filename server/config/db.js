const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Configure Google & Cloudflare public DNS resolvers to bypass local Wi-Fi DNS SRV lookup restrictions (querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.warn('[MongoDB DNS] Notice: Using system default DNS resolvers.');
}

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const directFallbackUri = process.env.MONGO_DIRECT_URI || primaryUri;

  if (!primaryUri) {
    console.error(`\n=====================================================`);
    console.error(`❌ [CRITICAL CONFIG ERROR]: MONGO_URI environment variable is not defined.`);
    console.error(`📌 Please define MONGO_URI in your server/.env file or deployment environment variables.`);
    console.error(`=====================================================\n`);
    process.exit(1);
  }

  // Monitor runtime connection errors
  mongoose.connection.on('error', (err) => {
    console.error(`\n=====================================================`);
    console.error(`❌ [MONGODB ATLAS RUNTIME ERROR]: ${err.message}`);
    console.error(`🚫 Local database fallback is strictly DISABLED.`);
    console.error(`=====================================================\n`);
  });

  mongoose.connection.on('disconnected', () => {
    console.error(`\n=====================================================`);
    console.error(`⚠️ [MONGODB ATLAS DISCONNECTED]: Connection to Atlas Cloud was lost.`);
    console.error(`🚫 Local database fallback is strictly DISABLED.`);
    console.error(`=====================================================\n`);
  });

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const currentUri = attempt > 2 ? directFallbackUri : primaryUri;
    try {
      if (attempt > 1) {
        console.log(`📡 [MongoDB Atlas] Reconnection attempt ${attempt}/${maxRetries}...`);
      }
      const conn = await mongoose.connect(currentUri, {
        family: 4,
        tlsAllowInvalidCertificates: true,
        serverSelectionTimeoutMS: 10000,
        retryWrites: true
      });
      console.log(`=====================================================`);
      console.log(`📡 [MongoDB Atlas Cloud Connected]`);
      console.log(`🌐 Host: ${conn.connection.host}`);
      console.log(`🗄️ Database: ${conn.connection.name}`);
      console.log(`✅ ALL READS AND WRITES ARE LIVE EXCLUSIVELY ON MONGODB ATLAS CLOUD!`);
      console.log(`=====================================================`);
      return;
    } catch (err) {
      console.warn(`[MongoDB Atlas] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error(`\n=====================================================`);
        console.error(`❌ [CRITICAL DATABASE ERROR]: MongoDB Atlas connection failed.`);
        console.error(`📌 Error Details: ${err.message}`);
        console.error(`🚫 Local database fallback is strictly DISABLED.`);
        console.error(`🚨 System will NOT connect to local MongoDB.`);
        console.error(`=====================================================\n`);
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;

