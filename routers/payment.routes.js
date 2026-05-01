const express = require("express")
const { initializePayment, verifyPayment } = require("../controllers/payment.controller")
const { verifyUser } = require("../controllers/user.controller")
const { logActivity } = require("../middlewares/activity.middleware")

const router = express.Router()

router.post("/payment/initialize",verifyUser,logActivity("Initiated payment","medium"), initializePayment)
router.get("/payment/verify/:reference",verifyUser,logActivity("Payment verified — order placed","low"),verifyPayment)

module.exports = router