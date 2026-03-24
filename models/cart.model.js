const mongoose = require("mongoose")

const CartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
      quantity: { type: Number, required: true, default: 1 },
    },
  ],
}, { timestamps: true, strict: "throw" })

const CartModel = mongoose.model("cart", CartSchema)

module.exports = CartModel