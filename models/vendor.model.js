const mongoose = require("mongoose")

const VendorSchema = new mongoose.Schema({
  storeName:        { type: String, required: true, unique: true },
  storeDescription: { type: String, required: true },
  owner:            { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  status:           { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },

  bvn:          { type: String, required: true },
  nin:          { type: String, required: true },
  houseAddress: { type: String, required: true },

  passportPhoto: {
    public_id:  { type: String, default: "" },
    secure_url: { type: String, default: "" },
  },

  businessCertificate: {
    public_id:  { type: String, default: "" },
    secure_url: { type: String, default: "" },
  },

  bankName:      { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountName:   { type: String, required: true },

  paystackSubaccountCode: { type: String, default: "" },

}, { timestamps: true })

const VendorModel = mongoose.model("vendor", VendorSchema)

module.exports = VendorModel