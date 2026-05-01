const UserModel  = require("../models/user.model")
const bcrypt     = require("bcrypt")
const jwt        = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const mailSender = require("../middlewares/mailer")
const otpgen     = require("otp-generator")
const OTPModel   = require("../models/otp.model")
const dns        = require("dns").promises

let transporter = nodemailer.createTransport({
  host:   "smtp.gmail.com",
  port:   465,
  secure: true,
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS,
  },
})

const sendMail = (mailOptions) => {
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error)
    } else {
      console.log("Email sent: " + info.response)
    }
  })
}

const isRealEmail = async (email) => {
  const domain = email.split("@")[1]
  try {
    const records = await dns.resolveMx(domain)
    return records && records.length > 0
  } catch (error) {
    return false
  }
}

const createUser = async (req, res) => {
  const { lastName, email, password, firstName, roles } = req.body

  const realEmail = await isRealEmail(email)
  if (!realEmail) {
    res.status(400).send({ message: "Please provide a real email" })
    return
  }

  try {
    const saltround      = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, saltround)
    const status         = roles === "vendor" ? "pending" : "active"

    const user = await UserModel.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      roles:    roles || "user",
      status,
    })

    const renderMail = await mailSender("welcomeMail.ejs", { firstName })

    const token = jwt.sign(
      { id: user._id, roles: user.roles, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30m" }
    )

    res.status(201).send({
      message: "user created successfully",
      data:    { lastName, email, firstName, roles: user.roles, status: user.status },
      token,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      email,
      subject: `Welcome ${firstName}!`,
      html:    renderMail,
    })

  } catch (error) {
    console.log(error)
    if (error.code === 11000) {
      res.status(400).send({ message: "User already registered" })
    } else {
      res.status(400).send({ message: "User creation failed" })
    }
  }
}

const login = async (req, res) => {
  const { email, password } = req.body

  try {
    const isUser = await UserModel.findOne({ email })
    if (!isUser) {
      res.status(404).send({ message: "Invalid credentials" })
      return
    }

    const isMatch = await bcrypt.compare(password, isUser.password)
    if (!isMatch) {
      res.status(404).send({ message: "Invalid credentials" })
      return
    }

    if (isUser.status === "suspended") {
      res.status(403).send({ message: "Your account has been suspended" })
      return
    }

    if (isUser.roles === "vendor" && isUser.status === "pending") {
      res.status(403).send({ message: "Your vendor account is awaiting admin approval" })
      return
    }

    const token = jwt.sign(
      { id: isUser._id, roles: isUser.roles, email: isUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    )

    res.status(200).send({
      message: "user logged in successfully",
      data:    { email: isUser.email, roles: isUser.roles, status: isUser.status, firstName: isUser.firstName, lastName: isUser.lastName },
      token,
    })

    const renderMail = await mailSender("loginMail.ejs", { firstName: isUser.firstName })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      email,
      subject: `Welcome back ${isUser.firstName}!`,
      html:    renderMail,
    })

  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "Invalid credentials" })
  }
}

const logout = async (req, res) => {
  try {
    const isUser = await UserModel.findById(req.user.id)
    if (!isUser) {
      res.status(404).send({ message: "User not found" })
      return
    }

    res.status(200).send({ message: "Logout successful" })

    const renderMail = await mailSender("logOut.ejs", { firstName: isUser.firstName })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      isUser.email,
      subject: `You have been logged out, ${isUser.firstName}`,
      html:    renderMail,
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Logout failed" })
  }
}

const editUser = async (req, res) => {
  const { firstName, lastName, birthday } = req.body
  const { id } = req.params

  try {
    const allowedUpdate = {
      ...(firstName && { firstName }),
      ...(lastName  && { lastName }),
      ...(birthday  && { birthday: new Date(birthday) }),
    }

    await UserModel.findByIdAndUpdate(id, allowedUpdate)
    res.status(200).send({ message: "User updated successfully" })
  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "User update failed" })
  }
}

const getAllUser = async (req, res) => {
  try {
    const users = await UserModel.find().select("-password")
    res.status(200).send({ message: "Users retrieved successfully", data: users })
  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "Users not found" })
  }
}

const deleteUser = async (req, res) => {
  const { id } = req.params

  try {
    const isDeleted = await UserModel.findByIdAndDelete(id)

    if (!isDeleted) {
      res.status(400).send({ message: "User failed to delete" })
      return
    }

    res.status(200).send({ message: "User deleted successfully" })

    const renderMail = await mailSender("deleteAccount.ejs", {
      firstName: isDeleted.firstName,
      email:     isDeleted.email,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      isDeleted.email,
      subject: `Account Deleted, ${isDeleted.firstName}`,
      html:    renderMail,
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "User failed to delete" })
  }
}

const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers["authorization"].split(" ")[1]
      ? req.headers["authorization"].split(" ")[1]
      : req.headers["authorization"].split(" ")[0]

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.status(401).send({ message: "User unauthorized" })
        return
      }
      req.user = decoded
      next()
    })
  } catch (error) {
    res.status(401).send({ message: "User unauthorized" })
  }
}

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.roles !== role) {
      res.status(403).send({ message: "Forbidden: you do not have permission" })
      return
    }
    next()
  }
}

const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id).select("-password")
    res.status(200).send({ message: "User retrieved successfully", data: user })
  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "User not found" })
  }
}

const requestOTP = async (req, res) => {
  const { email } = req.body

  try {
    const isUser = await UserModel.findOne({ email })

    if (!isUser) {
      res.status(404).send({ message: "Account not found" })
      return
    }

    const sendOTP = otpgen.generate(4, {
      upperCaseAlphabets: false,
      specialChars:       false,
      lowerCaseAlphabets: false,
      digits:             true,
    })

    await OTPModel.create({ email, otp: sendOTP })

    const otpMailContent = await mailSender("otpMail.ejs", {
      otp:       sendOTP,
      firstName: isUser.firstName,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      email,
      subject: `Your OTP Code`,
      html:    otpMailContent,
    })

    res.status(200).send({ message: "OTP sent successfully" })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "OTP request failed" })
  }
}

const forgotPassword = async (req, res) => {
  const { otp, email, newPassword } = req.body

  try {
    const otpRecord = await OTPModel.findOne({ email })

    if (!otpRecord) {
      res.status(404).send({ message: "Invalid OTP" })
      return
    }

    if (otp != otpRecord.otp) {
      res.status(404).send({ message: "Invalid OTP" })
      return
    }

    const saltround      = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, saltround)

    await UserModel.findOneAndUpdate({ email }, { password: hashedPassword }, { new: true })
    await OTPModel.findOneAndDelete({ email })

    res.status(200).send({ message: "Password reset successfully" })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Password reset failed" })
  }
}

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body

  try {
    const isUser = await UserModel.findById(req.user.id)

    if (!isUser) {
      res.status(400).send({ message: "Invalid user" })
      return
    }

    const isMatch = await bcrypt.compare(oldPassword, isUser.password)
    if (!isMatch) {
      res.status(400).send({ message: "Wrong password" })
      return
    }

    const saltround      = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, saltround)

    await UserModel.findByIdAndUpdate(req.user.id, { password: hashedPassword })

    res.status(200).send({ message: "Password changed successfully" })
  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Password change failed" })
  }
}

module.exports = {
  createUser,
  editUser,
  getAllUser,
  deleteUser,
  login,
  verifyUser,
  requireRole,
  getMe,
  requestOTP,
  forgotPassword,
  logout,
  changePassword,
}