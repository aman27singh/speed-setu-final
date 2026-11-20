/**
 * Speed Setu - Centralized MongoDB Database Safety Guard
 * 
 * Enforces strict, multi-tiered write protection across the entire application:
 * - Development (NODE_ENV=development): Writes allowed ONLY to "test_db".
 *   Writes to "speed_setu_db" or any other database are STRICTLY BLOCKED.
 * - Production (NODE_ENV=production): Writes allowed ONLY to "speed_setu_db".
 * 
 * Intercepts:
 * 1. Mongoose Document Lifecycle (save)
 * 2. Mongoose Query Mutations (updateOne, updateMany, findOneAndUpdate, deleteOne, deleteMany, etc.)
 * 3. Mongoose Model Batch Operations (insertMany)
 * 4. Direct Mongoose Connection Collections (connection.collection)
 * 5. Low-Level Database Driver Collections (connection.db.collection)
 * 6. Low-Level MongoClient Databases & Collections (client.db().collection)
 * 7. Bulk Operations (bulkWrite)
 * 8. Database & Collection Drop Operations (dropDatabase, dropCollection)
 * 9. All Secondary Connections (mongoose.createConnection)
 */

const mongoose = require('mongoose');

function validateWriteOperation(connection, operationType, collectionName) {
  const envRaw = (process.env.NODE_ENV || '').trim();
  const isProd = envRaw === 'production';
  const isDev = envRaw === 'development';

  if (!isProd && !isDev) {
    const errorMsg = `[DATABASE SAFETY GUARD] BLOCKED: Invalid NODE_ENV "${process.env.NODE_ENV}". Set development or production.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 1. Verify readyState
  const readyState = connection?.readyState ?? (connection?.topology?.isConnected?.() ? 1 : undefined);
  if (readyState !== undefined && readyState !== 1) {
    const errorMsg = `[DATABASE SAFETY GUARD] BLOCKED: Cannot execute write "${operationType}" on "${collectionName}". Connection readyState is ${readyState} (must be 1: connected).`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Verify active database name
  const activeDbName = connection?.name || connection?.db?.databaseName || connection?.databaseName;
  if (!activeDbName) {
    const errorMsg = `[DATABASE SAFETY GUARD] BLOCKED: Cannot execute write "${operationType}" on "${collectionName}". Active database name cannot be verified.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 3. Environment-specific enforcement
  if (!isProd) {
    // DEVELOPMENT MODE: writes allowed ONLY to "test_db"
    if (activeDbName === 'speed_setu_db') {
      const errorMsg = `🚨 [DATABASE SAFETY GUARD CRITICAL EXCEPTION] 🚨\nBLOCKED: Attempted write operation "${operationType}" on collection "${collectionName}" targeting PRODUCTION database "speed_setu_db" while running in DEVELOPMENT mode!\nWrites to production are STRICTLY PROHIBITED in development.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (activeDbName !== 'test_db') {
      const errorMsg = `[DATABASE SAFETY GUARD] BLOCKED: Attempted write operation "${operationType}" on unauthorized database "${activeDbName}". In development, writes are strictly restricted to "test_db".`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  } else {
    // PRODUCTION MODE: writes allowed ONLY to "speed_setu_db"
    if (activeDbName !== 'speed_setu_db') {
      const errorMsg = `[DATABASE SAFETY GUARD] BLOCKED: Attempted write operation "${operationType}" on unexpected database "${activeDbName}" while in production mode. Expected "speed_setu_db".`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  return true;
}

/**
 * Wrap low-level collection methods to prevent direct driver bypasses
 */
function protectCollection(collection, connection) {
  if (!collection || collection.__safetyGuardAttached) return collection;

  const mutatingMethods = [
    'insertOne', 'insertMany', 'updateOne', 'updateMany',
    'replaceOne', 'deleteOne', 'deleteMany', 'bulkWrite',
    'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate',
    'drop', 'dropIndexes', 'createIndex', 'createIndexes'
  ];

  for (const method of mutatingMethods) {
    if (typeof collection[method] === 'function') {
      const original = collection[method].bind(collection);
      collection[method] = function (...args) {
        validateWriteOperation(connection, `collection.${method}`, collection.collectionName || collection.name);
        return original(...args);
      };
    }
  }

  collection.__safetyGuardAttached = true;
  return collection;
}

/**
 * Protect a database instance (db.collection and db.dropDatabase)
 */
function protectDbInstance(dbInstance) {
  if (!dbInstance || dbInstance.__safetyGuardAttached) return dbInstance;

  const origCol = dbInstance.collection.bind(dbInstance);
  dbInstance.collection = function (colName, colOptions) {
    const col = origCol(colName, colOptions);
    return protectCollection(col, { readyState: 1, name: dbInstance.databaseName, db: dbInstance });
  };

  const origDrop = dbInstance.dropDatabase.bind(dbInstance);
  dbInstance.dropDatabase = function (...args) {
    validateWriteOperation({ readyState: 1, name: dbInstance.databaseName, db: dbInstance }, 'db.dropDatabase', '*');
    return origDrop(...args);
  };

  dbInstance.__safetyGuardAttached = true;
  return dbInstance;
}

/**
 * Attach safety protection to a specific Mongoose Connection
 */
function protectConnection(connection) {
  if (!connection || connection.__safetyGuardAttached) return connection;

  // Intercept connection.collection
  const originalCollection = connection.collection.bind(connection);
  connection.collection = function (name, options) {
    const col = originalCollection(name, options);
    return protectCollection(col, connection);
  };

  const attachDbProtection = () => {
    if (connection.db) {
      protectDbInstance(connection.db);
    }
    try {
      const client = connection.getClient?.();
      if (client && !client.__safetyGuardAttached) {
        const origClientDb = client.db.bind(client);
        client.db = function (dbName, options) {
          const dbInst = origClientDb(dbName, options);
          return protectDbInstance(dbInst);
        };
        client.__safetyGuardAttached = true;
      }
    } catch (e) {
      // client may not be initialized yet
    }
  };

  // Intercept when connection opens
  connection.on('open', attachDbProtection);
  if (connection.readyState === 1) {
    attachDbProtection();
  }

  connection.__safetyGuardAttached = true;
  return connection;
}

/**
 * Global Initialization: Registers Mongoose plugin and connection hooks
 */
function initSafetyGuard() {
  if (global.__speedSetuSafetyGuardInitialized) return;

  // 1. Global Mongoose Plugin for all schemas & models
  mongoose.plugin((schema) => {
    // Hook: save
    schema.pre('save', function () {
      const conn = this.constructor.db || mongoose.connection;
      validateWriteOperation(conn, 'model.save', this.constructor.collection?.name || 'unknown');
    });

    // Hook: insertMany
    schema.pre('insertMany', function () {
      const conn = this.db || mongoose.connection;
      validateWriteOperation(conn, 'model.insertMany', this.collection?.name || 'unknown');
    });

    // Hooks: Query-level mutations
    const queryMutations = [
      'updateOne', 'updateMany', 'findOneAndUpdate',
      'findOneAndReplace', 'findOneAndDelete', 'deleteOne',
      'deleteMany', 'replaceOne'
    ];

    schema.pre(queryMutations, function () {
      const conn = this.model?.db || mongoose.connection;
      validateWriteOperation(conn, `query.${this.op}`, this.model?.collection?.name || 'unknown');
    });
  });

  // 2. Protect default connection
  protectConnection(mongoose.connection);

  // 3. Intercept mongoose.createConnection to protect any secondary connections
  const origCreateConnection = mongoose.createConnection.bind(mongoose);
  mongoose.createConnection = function (...args) {
    const conn = origCreateConnection(...args);
    protectConnection(conn);
    return conn;
  };

  global.__speedSetuSafetyGuardInitialized = true;
  console.log('🛡️ [DATABASE SAFETY GUARD] Initialized: Strict multi-tier write protection active.');
}

module.exports = {
  initSafetyGuard,
  validateWriteOperation,
  protectConnection,
  protectDbInstance,
  protectCollection
};
