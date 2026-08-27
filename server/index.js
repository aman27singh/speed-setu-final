const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5050;

// Connect to MongoDB Database
connectDB();

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
    database: 'MongoDB Atlas Cloud (speed_setu_db)',
    timestamp: new Date().toISOString()
  });
});

// Enforce MongoDB Atlas Connection Check Middleware for all API endpoints
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      dbError: true,
      error: 'MongoDB Atlas Connection Error',
      message: 'Failed to connect to MongoDB Atlas Cloud database. Live updates and database operations are currently unavailable.'
    });
  }
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/quotations', require('./routes/quotations'));
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

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Speed Setu Backend Server Running on Port ${PORT}`);
  console.log(`📡 MongoDB Atlas Database Monitor Active: speed_setu_db`);
  console.log(`====================================================`);
});
