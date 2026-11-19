const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
const { initSafetyGuard } = require('./safetyGuard');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Database Safety Guard immediately before any model or query initialization
initSafetyGuard();

// Configure Google & Cloudflare public DNS resolvers to bypass local Wi-Fi DNS SRV lookup restrictions (querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.warn('[MongoDB DNS] Notice: Using system default DNS resolvers.');
}

/**
 * Centralized Database Connection Resolver
 * Strictly enforces that development can NEVER connect to or fallback to speed_setu_db.
 */
const getDatabaseConfig = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const targetEnv = isProd ? 'production' : 'development';
  const targetDbName = isProd ? 'speed_setu_db' : 'test_db';

  let primaryUri;
  if (isProd) {
    primaryUri = process.env.MONGO_URI_PROD || process.env.MONGO_URI;
    if (!primaryUri) {
      throw new Error('❌ [CRITICAL CONFIG ERROR]: Neither MONGO_URI_PROD nor MONGO_URI is defined for production!');
    }
    if (!primaryUri.includes('/speed_setu_db')) {
      throw new Error(`🚨 [CRITICAL SECURITY ERROR]: Production environment URI does not target "speed_setu_db"! Refusing connection.`);
    }
  } else {
    // Development environment
    primaryUri = process.env.MONGO_URI_DEV || process.env.MONGO_URI;
    if (!primaryUri) {
      throw new Error('❌ [CRITICAL CONFIG ERROR]: Database URI for development is not defined! Please set MONGO_URI_DEV in server/.env.');
    }
    // Prevent accidental production URI usage in development
    if (primaryUri.includes('/speed_setu_db')) {
      throw new Error('🚨 [CRITICAL SECURITY ERROR]: Detected production database "speed_setu_db" in development URI! Development is strictly restricted to "test_db".');
    }
    if (!primaryUri.includes('/test_db')) {
      throw new Error('🚨 [CRITICAL SECURITY ERROR]: Development database URI must target "test_db"!');
    }
  }

  const directFallbackUri = process.env.MONGO_DIRECT_URI || primaryUri;
  if (isProd && !directFallbackUri.includes('/speed_setu_db')) {
    throw new Error('🚨 [CRITICAL SECURITY ERROR]: MONGO_DIRECT_URI in production does not target "speed_setu_db"!');
  }
  if (!isProd && directFallbackUri.includes('/speed_setu_db')) {
    throw new Error('🚨 [CRITICAL SECURITY ERROR]: MONGO_DIRECT_URI in development cannot target "speed_setu_db"!');
  }

  return {
    isProd,
    targetEnv,
    targetDbName,
    primaryUri,
    directFallbackUri
  };
};

// Track intentional disconnects to distinguish from unexpected network loss
let isIntentionalDisconnect = false;

const connectDB = async () => {
  const { isProd, targetEnv, targetDbName, primaryUri, directFallbackUri } = getDatabaseConfig();

  // Monitor runtime connection errors
  mongoose.connection.on('error', (err) => {
    console.error(`\n=====================================================`);
    console.error(`❌ [MONGODB ATLAS RUNTIME ERROR]: ${err.message}`);
    console.error(`🚫 Local database fallback is strictly DISABLED.`);
    console.error(`=====================================================\n`);
  });

  mongoose.connection.on('disconnected', () => {
    if (!isIntentionalDisconnect) {
      console.warn(`\n=====================================================`);
      console.warn(`⚠️ [MONGODB ATLAS NOTICE]: Socket disconnected. Driver is auto-reconnecting...`);
      console.warn(`=====================================================\n`);
    }
  });

  mongoose.connection.on('reconnected', () => {
    console.log(`📡 [MongoDB Atlas]: Connection successfully restored.`);
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

      // Connection pool and resilience configuration
      const conn = await mongoose.connect(currentUri, {
        family: 4,
        tlsAllowInvalidCertificates: true,
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 60000,           // Recycle idle sockets before cloud NAT timeout (prevents idle disconnects)
        socketTimeoutMS: 45000,         // Fail slow/hung queries after 45s
        connectTimeoutMS: 15000,        // Connection timeout
        serverSelectionTimeoutMS: 10000,// Fast fail if cluster is unreachable
        heartbeatFrequencyMS: 10000,    // Regular cluster health heartbeats
        retryWrites: true
      });

      console.log(`=====================================================`);
      console.log(`📡 [MongoDB Atlas Cloud Connected]`);
      console.log(`🌐 Environment: ${targetEnv.toUpperCase()}`);
      console.log(`🗄️ Database: ${conn.connection.name}`);
      console.log(`🌐 Host: ${conn.connection.host}`);
      if (isProd) {
        console.log(`🔒 PRODUCTION MODE: Live data connected to speed_setu_db`);
      } else {
        console.log(`🧪 DEVELOPMENT MODE: Safe operations connected to test_db`);
      }
      console.log(`🛡️ SAFETY GUARD: Active`);
      console.log(`=====================================================`);
      return conn;
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

const disconnectDB = async () => {
  isIntentionalDisconnect = true;
  await mongoose.disconnect();
  isIntentionalDisconnect = false;
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
module.exports.getDatabaseConfig = getDatabaseConfig;
