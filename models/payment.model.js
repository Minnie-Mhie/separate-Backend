// models/payment.model.js
const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  },

  email: {
    type: String,
    required: true,
  },

  amount: {
    type: Number,
    required: true,
  },

  currency: {
    type: String,
    default: "NGN",
  },

  reference: {
    type: String,
    required: true,
    unique: true,
  },

  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },

  paymentMethod: {
    type: String,
    default: "paystack",
  },

  paidAt: {
    type: Date,
  },

}, { timestamps: true })

module.exports = mongoose.model("Payment", paymentSchema)