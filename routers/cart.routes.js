const express = require("express")
const {
  addToCart,
  getMyCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require("../controllers/cart.controller")
const { verifyUser } = require("../controllers/user.controller")

const router = express.Router()

router.post("/cart/add", verifyUser, addToCart)
router.get("/cart", verifyUser, getMyCart)
router.patch("/cart/update", verifyUser, updateCartItem)
router.delete("/cart/remove/:productId", verifyUser, removeFromCart)
router.delete("/cart/clear", verifyUser, clearCart)

module.exports = router