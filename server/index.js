const path = require('path');
// Load environment variables from .env without overriding process.env.NODE_ENV
// npm scripts (cross-env) are the single source of truth for NODE_ENV
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5050;

// Start server with DB initialization happening before listening
const isDirectRun = require.main === module || (require.main && require.main.filename === path.resolve(__dirname, '..', 'index.js'));
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Speed Setu Backend Server Running on Port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1);
  }
};

if (isDirectRun) {
  startServer();
}

app.startServer = startServer;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    return res.status(503).json({
      status: 'offline',
      connected: false,
      database: 'MongoDB Atlas (Disconnected)',
      error: 'MongoDB Atlas Connection Error: Unable to connect to cloud cluster',
      timestamp: new Date().toISOString()
    });
  }
  res.json({
    status: 'online',
    connected: true,
    environment: process.env.NODE_ENV,
    database: `MongoDB Atlas Cloud (${mongoose.connection.name || 'connected'})`,
    timestamp: new Date().toISOString()
  });
});

const { validateWriteOperation } = require('./config/safetyGuard');

// Request Correlation & Audit Middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const activeDb = mongoose.connection.name || 'unconnected';
  const start = Date.now();
  console.log(`\n===============================================================`);
  console.log(`📡 [REQ ${correlationId}] ${req.method} ${req.originalUrl}`);
  console.log(`🗄️ Active Target DB: "${activeDb}" | Environment: "${process.env.NODE_ENV}"`);
  console.log(`===============================================================`);

  res.on('finish', () => {
    console.log(`🏁 [RES ${correlationId}] ${req.method} ${req.originalUrl} -> Status: ${res.statusCode} (${Date.now() - start}ms)`);
  });

  next();
});

// Enforce MongoDB Atlas Connection Check & Safety Guard Middleware for all API endpoints
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      dbError: true,
      error: 'MongoDB Atlas Connection Error',
      message: 'Failed to connect to MongoDB Atlas Cloud database. Live updates and database operations are currently unavailable.'
    });
  }

  // Intercept write operations (POST, PUT, PATCH, DELETE) with Database Safety Guard
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      validateWriteOperation(mongoose.connection, `${req.method} ${req.originalUrl}`, 'HTTP API Endpoint');
    } catch (guardErr) {
      console.error(`🚨 [SAFETY GUARD INTERCEPTED REQUEST]: ${guardErr.message}`);
      return res.status(403).json({
        success: false,
        safetyGuardBlocked: true,
        error: 'Database Safety Violation',
        message: guardErr.message
      });
    }
  }

  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/rate-cards', require('./routes/rateCards'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/payables', require('./routes/payables'));
app.use('/api/transporters', require('./routes/transporters'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/consignor-consignee', require('./routes/consignorConsignee'));
app.use('/api/parties', require('./routes/consignorConsignee'));
app.use('/api/cn-templates', require('./routes/cnTemplates'));

// Reverse Proxy Fallback for shipments, consignor-consignee, parties, and cn-templates
app.use('/shipments', require('./routes/shipments'));
app.use('/consignor-consignee', require('./routes/consignorConsignee'));
app.use('/parties', require('./routes/consignorConsignee'));
app.use('/cn-templates', require('./routes/cnTemplates'));

// Sales Register Report (Mounted with and without /api prefix for reverse proxy compatibility)
const { salesRegisterRouter } = require('./routes/salesRegister.route');
const { protect, adminOnly } = require('./middleware/auth');
const Invoice = require('./models/Invoice');
const srRouter = salesRegisterRouter({ InvoiceModel: Invoice, authMiddleware: [protect, adminOnly] });
app.use('/api/reports/sales-register', srRouter);
app.use('/reports/sales-register', srRouter);

// Reverse Proxy Fallback for reports (/reports -> routes/reports)
app.use('/reports', require('./routes/reports'));

module.exports = app;
