const express = require("express")
const router = express.Router()
const { initializePayment, verifyPayment, getBanks } = require("../controllers/payment.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")

router.post("/initialize", verifyUser, requireRole("user"), initializePayment)
router.get("/verify/:reference", verifyUser, verifyPayment)
router.get("/banks", getBanks)

module.exports = router