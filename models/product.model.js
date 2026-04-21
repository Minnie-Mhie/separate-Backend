const mongoose = require("mongoose")

const ProductSchema = new mongoose.Schema({
  productName:        { type: String, required: true },
  productPrice:       { type: Number, required: true },
  vendorPrice:        { type: Number, required: true },
  commissionRate:     { type: Number, required: true, default: 0 },
  productQuantity:    { type: Number, required: true },
  productDescription: { type: String, required: true },
  productImage: {
    public_id:  { type: String, required: true },
    secure_url: { type: String, required: true },
  },
  category:  { type: String, required: true },
  videoUrl:  { type: String, default: "" },
  status:    { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  vendor:    { type: mongoose.Schema.Types.ObjectId, ref: "vendor", required: false },
}, { timestamps: true, strict: "true" })

const ProductModel = mongoose.model("product", ProductSchema)

module.exports = ProductModel