const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Shipment = require('../models/Shipment');
const Quotation = require('../models/Quotation');
const Trip = require('../models/Trip');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Payable = require('../models/Payable');

// GET /api/reports/overview — MongoDB Live Aggregation
router.get('/overview', async (req, res) => {
  try {
    const [companiesCount, shipments, tripsCount, invoices, payments, expenses, payables] = await Promise.all([
      Company.countDocuments({ status: 'Active' }),
      Shipment.find(),
      Trip.countDocuments(),
      Invoice.find({ status: { $ne: 'Cancelled' } }),
      Payment.find({ status: { $ne: 'Failed' } }),
      Expense.find(),
      Payable.find({ status: { $ne: 'Paid' } })
    ]);

    const totalShipments = shipments.length;
    const activeShipments = shipments.filter(s => ['Booked', 'Picked Up', 'In Transit', 'Out for Delivery'].includes(s.status)).length;
    const deliveredShipments = shipments.filter(s => s.status === 'Delivered').length;
    const pendingPODs = shipments.filter(s => s.podStatus === 'Pending').length;

    const totalRevenue = invoices.reduce((acc, i) => acc + (i.totalAmount || i.grandTotal || 0), 0);
    const collectedRevenue = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const outstandingReceivables = invoices.reduce((acc, i) => acc + (i.balanceDue || i.balanceAmount || 0), 0);
    const pendingPayables = payables.reduce((acc, p) => acc + (p.amount || p.outstandingAmount || 0), 0);
    const grossProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

    res.json({
      totalRevenue,
      collectedRevenue,
      totalExpenses,
      outstandingReceivables,
      pendingPayables,
      grossProfit,
      profitMargin,
      totalShipments,
      activeShipments,
      deliveredShipments,
      pendingPODs,
      companiesCount,
      tripsCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
