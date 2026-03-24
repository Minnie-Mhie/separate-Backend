const express = require("express")
const {
  applyAsVendor,
  approveVendor,
  rejectVendor,
  getAllVendors,
  getMyStore,
} = require("../controllers/vendor.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")

const router = express.Router()
router.post("/vendor/apply", verifyUser, applyAsVendor)

router.get("/vendor/mystore", verifyUser, requireRole("vendor"), getMyStore)

router.get("/vendor/all", verifyUser, requireRole("admin"), getAllVendors)
router.patch("/vendor/approve/:id", verifyUser, requireRole("admin"), approveVendor)
router.patch("/vendor/reject/:id", verifyUser, requireRole("admin"), rejectVendor)
// router.get("/vendor/VendorDashboard", verifyUser, requireRole("vendor"), Dashboard)

module.exports = router