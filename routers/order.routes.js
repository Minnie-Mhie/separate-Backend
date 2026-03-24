const express = require("express")
const {
  placeOrder,
  getMyOrders,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getVendorOrders,
} = require("../controllers/order.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")
const { logActivity } = require("../middlewares/activity.middleware")

const router = express.Router()
router.post("/orders/place", verifyUser, logActivity("Placed an order", "low"), placeOrder)
router.get("/orders/mine", verifyUser, getMyOrders)
router.patch("/orders/cancel/:id", verifyUser, logActivity("Cancelled an order", "medium"), cancelOrder)
router.get("/orders/vendor", verifyUser, requireRole("vendor"), getVendorOrders)

router.get("/orders/all", verifyUser, requireRole("admin"), getAllOrders)
router.patch("/orders/status/:id", verifyUser, logActivity("Updated order status", "low"), updateOrderStatus)

module.exports = router