const express = require("express")
const router = express.Router()
const { getSettings, updateCommissionRate } = require("../controllers/platformSettings.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")

router.get("/", verifyUser, getSettings)
router.patch("/commission", verifyUser, requireRole("admin"), updateCommissionRate)

module.exports = router