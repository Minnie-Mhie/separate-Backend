const express = require("express")
const {
  getAllActivity,
  getUserActivity,
  suspendUser,
  restoreUser,
} = require("../controllers/kyc.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")

const router = express.Router()

router.get("/kyc", verifyUser, requireRole("admin"), getAllActivity)
router.get("/kyc/user/:userId", verifyUser, requireRole("admin"), getUserActivity)
router.patch("/kyc/suspend/:userId", verifyUser, requireRole("admin"), suspendUser)
router.patch("/kyc/restore/:userId", verifyUser, requireRole("admin"), restoreUser)

module.exports = router