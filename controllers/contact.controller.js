const ContactModel = require("../models/contact.model")
const nodemailer = require("nodemailer")
const mailSender = require("../middlewares/mailer")

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS,
  },

})

const sendMessage = async (req, res) => {
  const { name, email, message } = req.body

  try {
    const contact = await ContactModel.create({ name, email, message })

    res.status(201).send({
      message: "Message sent successfully",
      data: contact,
    })

    const renderMail = await mailSender("contactMail.ejs", { name, email, message })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: process.env.NODE_MAIL_US,
      subject: `New Contact Message from ${name}`,
      replyTo: email,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error)
      } else {
        console.log("Email sent: " + info.response)
      }
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to send message",
    })
  }
}

const getAllMessages = async (req, res) => {
  try {
    const messages = await ContactModel.find().sort({ createdAt: -1 })

    res.status(200).send({
      message: "Messages retrieved successfully",
      total: messages.length,
      data: messages,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve messages",
    })
  }
}

const markAsRead = async (req, res) => {
  const { id } = req.params

  try {
    await ContactModel.findByIdAndUpdate(id, { status: "read" })

    res.status(200).send({
      message: "Message marked as read",
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to mark message as read",
    })
  }
}

module.exports = {
  sendMessage,
  getAllMessages,
  markAsRead,
}