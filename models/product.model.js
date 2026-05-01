const mongoose = require("mongoose")

const ProductSchema = new mongoose.Schema({
  productName:        { type: String, required: true },
  basePrice:          { type: Number, required: true },
  productPrice:       { type: Number, required: true },
  productQuantity:    { type: Number, required: true },
  productDescription: { type: String, required: true },
  productImage: {
    public_id:  { type: String, required: true },
    secure_url: { type: String, required: true },
  },
  category:  { type: String, required: true },
  videoUrl:  { type: String, default: "" },
  status:    { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user",   required: true },
  vendor:    { type: mongoose.Schema.Types.ObjectId, ref: "vendor", required: false },
}, { timestamps: true })

const ProductModel = mongoose.model("product", ProductSchema)

module.exports = ProductModel