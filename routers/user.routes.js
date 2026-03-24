const express = require('express')
const { createUser, editUser, getAllUser, deleteUser, login, getMe, verifyUser, requireRole, requestOTP, forgotPassword, logout, changePassword,} = require('../controllers/user.controller')
const { verify } = require('jsonwebtoken')
const router = express.Router()

router.post('/register', createUser)
router.post('/login', login)
router.get('/me', verifyUser, getMe)
router.get('/getUsers', verifyUser, requireRole("admin"), getAllUser)
router.delete('/deleteUser/:id', verifyUser, requireRole("admin"), deleteUser)
router.patch('/edituser/:id', verifyUser, editUser)
router.post('/request-otp',requestOTP)
router.post('/logout', verifyUser, logout)
router.post('/forgotpassword', forgotPassword)
router.post('/changepassword', verifyUser, changePassword)
// router.get('/home', Home)

// router.get("/Dashboard", verifyUser, Dashboard)

module.exports = router
