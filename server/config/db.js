const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
const dotenv = require('dotenv');
const { initSafetyGuard } = require('./safetyGuard');

// Load environment variables from server/.env before accessing MONGO_URI
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configure Google & Cloudflare public DNS resolvers to prevent SRV lookup failures
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Use system default DNS resolvers if setServers is unavailable
}

// Initialize Database Safety Guard immediately before any model or query initialization
initSafetyGuard();

/**
 * Determine database name strictly from process.env.NODE_ENV
 * Single source of truth is the npm execution command:
 *   npm run dev -> NODE_ENV=development -> test_db
 *   npm start   -> NODE_ENV=production  -> speed_setu_db
 */
const getDatabaseConfig = () => {
  const environment = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : null;

  const databaseName =
    environment === 'development'
      ? 'test_db'
      : environment === 'production'
        ? 'speed_setu_db'
        : null;

  if (!databaseName) {
    throw new Error(`Invalid environment configuration: NODE_ENV is "${environment}". Use "npm run dev" for development (test_db) or "npm start" for production (speed_setu_db).`);
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  return {
    environment,
    databaseName,
    mongoUri
  };
};

// Track intentional disconnects to distinguish from unexpected network drops
let isIntentionalDisconnect = false;

const connectDB = async () => {
  const { environment, databaseName, mongoUri } = getDatabaseConfig();

  // Monitor runtime connection errors
  mongoose.connection.on('error', (err) => {
    console.error(`❌ [MONGODB RUNTIME ERROR]: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    if (!isIntentionalDisconnect) {
      console.warn(`⚠️ [MONGODB NOTICE]: Socket disconnected. Driver is auto-reconnecting...`);
    }
  });

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (attempt > 1) {
        console.log(`📡 [MongoDB] Reconnection attempt ${attempt}/${maxRetries}...`);
      }

      const conn = await mongoose.connect(mongoUri, {
        dbName: databaseName,
        family: 4,
        tlsAllowInvalidCertificates: true,
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 60000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true
      });

      // Verify actual connected database matches expected
      const actualDbName = conn.connection.name;
      if (actualDbName !== databaseName) {
        throw new Error(`[DATABASE MISMATCH]: Expected to connect to "${databaseName}", but connected to "${actualDbName}".`);
      }

      // Startup verification log format as required in Section 5
      console.log(`Environment: ${environment.toUpperCase()}`);
      console.log(`Database: ${actualDbName}`);
      console.log(`MongoDB: Connected`);

      return conn;
    } catch (err) {
      console.warn(`[MongoDB] Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error(`❌ [CRITICAL DATABASE ERROR]: MongoDB connection failed: ${err.message}`);
        process.exit(1);
      }
    }
  }
};

const disconnectDB = async () => {
  isIntentionalDisconnect = true;
  await mongoose.disconnect();
  isIntentionalDisconnect = false;
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
module.exports.getDatabaseConfig = getDatabaseConfig;
