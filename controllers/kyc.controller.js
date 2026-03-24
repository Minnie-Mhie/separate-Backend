const ActivityModel = require("../models/activity.model")
const UserModel = require("../models/user.model")
const nodemailer = require("nodemailer") // ✅ fixed: was missing
const mailSender = require("../middlewares/mailer") // ✅ fixed: was missing

let transporter = nodemailer.createTransport({ // ✅ fixed: was missing
  service: 'gmail',
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS
  }
})

const getAllActivity = async (req, res) => {
  const { riskLevel, status } = req.query

  try {
    let filter = {}

    if (riskLevel) {
      filter.riskLevel = riskLevel
    }

    if (status) {
      filter.status = status
    }

    const activities = await ActivityModel.find(filter)
      .populate("user", "firstName lastName email roles status")
      .sort({ createdAt: -1 })

    res.status(200).send({
      message: "Activities retrieved successfully",
      total: activities.length,
      data: activities,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve activities",
    })
  }
}

const getUserActivity = async (req, res) => {
  const { userId } = req.params

  try {
    const user = await UserModel.findById(userId).select("-password")

    if (!user) {
      res.status(404).send({
        message: "User not found",
      })
      return
    }

    const activities = await ActivityModel.find({ user: userId })
      .sort({ createdAt: -1 })

    res.status(200).send({
      message: "User activity retrieved successfully",
      user,
      total: activities.length,
      data: activities,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve user activity",
    })
  }
}

const suspendUser = async (req, res) => {
  const { userId } = req.params

  try {
    const user = await UserModel.findById(userId)

    if (!user) {
      res.status(404).send({
        message: "User not found",
      })
      return
    }

    if (user.roles === "admin") {
      res.status(403).send({
        message: "Cannot suspend an admin account",
      })
      return
    }

    await UserModel.findByIdAndUpdate(userId, { status: "suspended" })

    res.status(200).send({
      message: "User suspended successfully",
    })

    const renderMail = await mailSender("suspendAccount.ejs", {
      firstName: user.firstName,
      email: user.email, // ✅ fixed: was missing email
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: user.email,
      subject: `Account Suspended, ${user.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to suspend user",
    })
  }
}

const restoreUser = async (req, res) => {
  const { userId } = req.params

  try {
    const user = await UserModel.findById(userId)

    if (!user) {
      res.status(404).send({
        message: "User not found",
      })
      return
    }

    await UserModel.findByIdAndUpdate(userId, { status: "active" })

    res.status(200).send({
      message: "User restored successfully",
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to restore user",
    })
  }
}

module.exports = {
  getAllActivity,
  getUserActivity,
  suspendUser,
  restoreUser,
}