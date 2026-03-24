const express = require("express")
const { sendMessage, getAllMessages, markAsRead } = require("../controllers/contact.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")

const router = express.Router()

router.post("/contact", sendMessage)
router.get("/contact/all", verifyUser, requireRole("admin"), getAllMessages)
router.patch("/contact/read/:id", verifyUser, requireRole("admin"), markAsRead)

module.exports = router