const mongoose = require("mongoose")

const VendorSchema = new mongoose.Schema({
  storeName: { type: String, required: true, unique: true },
  storeDescription: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  bankName: { type: String, default: "" },
  bankCode: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  paystackSubaccountCode: { type: String, default: "" },
}, { timestamps: true, strict: "throw" })

const VendorModel = mongoose.model("vendor", VendorSchema)

module.exports = VendorModel