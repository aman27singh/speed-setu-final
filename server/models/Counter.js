const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. 'cn_seq'
  seq: { type: Number, default: 250 }
});

module.exports = mongoose.model('Counter', CounterSchema);
