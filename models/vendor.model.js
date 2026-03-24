const mongoose = require("mongoose")

const VendorSchema = new mongoose.Schema({
  storeName: { type: String, required: true, unique: true },
  storeDescription: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true, strict: "throw" })

const VendorModel = mongoose.model("vendor", VendorSchema)

module.exports = VendorModel