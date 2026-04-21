const VendorModel = require("../models/vendor.model")
const UserModel = require("../models/user.model")
const nodemailer = require("nodemailer")
const mailSender = require("../middlewares/mailer")
const axios = require("axios")

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS
  }
})

const applyAsVendor = async (req, res) => {
  const { storeName, storeDescription, bankName, bankCode, accountNumber } = req.body

  try {
    const existingApplication = await VendorModel.findOne({ owner: req.user.id })
    if (existingApplication) {
      res.status(400).send({ message: "You have already submitted a vendor application" })
      return
    }

    const vendor = await VendorModel.create({
      storeName,
      storeDescription,
      owner: req.user.id,
      bankName,
      bankCode,
      accountNumber,
    })

    await UserModel.findByIdAndUpdate(req.user.id, {
      roles: "vendor",
      status: "pending",
    })

    res.status(201).send({
      message: "Vendor application submitted successfully. Await admin approval.",
      data: vendor,
    })

    const isUser = await UserModel.findById(req.user.id)
    const renderMail = await mailSender("pendingVendor.ejs", {
      firstName: isUser.firstName,
      storeName: vendor.storeName,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: isUser.email,
      subject: `Application Received, ${isUser.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) { console.log(error) }
      else { console.log('Email sent: ' + info.response) }
    })

  } catch (error) {
    console.log(error)
    if (error.code == 11000) {
      res.status(400).send({ message: "A vendor with that store name already exists" })
    } else {
      res.status(400).send({ message: "Vendor application failed" })
    }
  }
}

const approveVendor = async (req, res) => {
  const { id } = req.params

  try {
    const vendor = await VendorModel.findById(id)
    if (!vendor) {
      res.status(404).send({ message: "Vendor application not found" })
      return
    }

    if (!vendor.bankCode || !vendor.accountNumber) {
      res.status(400).send({ message: "Vendor has not provided bank details. Cannot create subaccount." })
      return
    }

    const isUser = await UserModel.findById(vendor.owner)

    const paystackResponse = await axios.post(
      "https://api.paystack.co/subaccount",
      {
        business_name: vendor.storeName,
        settlement_bank: vendor.bankCode,
        account_number: vendor.accountNumber,
        percentage_charge: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    const subaccountCode = paystackResponse.data.data.subaccount_code

    await VendorModel.findByIdAndUpdate(id, {
      status: "approved",
      paystackSubaccountCode: subaccountCode,
    })
    await UserModel.findByIdAndUpdate(vendor.owner, { status: "active" })

    res.status(200).send({ message: "Vendor approved successfully" })

    const renderMail = await mailSender("approveVendor.ejs", {
      firstName: isUser.firstName,
      storeName: vendor.storeName,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: isUser.email,
      subject: `Application Update, ${isUser.firstName}`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) { console.log(error) }
      else { console.log('Email sent: ' + info.response) }
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to approve vendor" })
  }
}

const rejectVendor = async (req, res) => {
  const { id } = req.params

  try {
    const vendor = await VendorModel.findById(id)
    if (!vendor) {
      res.status(404).send({ message: "Vendor application not found" })
      return
    }

    await VendorModel.findByIdAndUpdate(id, { status: "rejected" })
    await UserModel.findByIdAndUpdate(vendor.owner, { roles: "user", status: "active" })

    res.status(200).send({ message: "Vendor application rejected" })

    const isUser = await UserModel.findById(vendor.owner)
    const renderMail = await mailSender("rejectVendor.ejs", {
      firstName: isUser.firstName,
      storeName: vendor.storeName,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: isUser.email,
      subject: `Application Update, ${isUser.firstName}`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) { console.log(error) }
      else { console.log('Email sent: ' + info.response) }
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to reject vendor" })
  }
}

const getAllVendors = async (req, res) => {
  try {
    const vendors = await VendorModel.find().populate("owner", "firstName lastName email status")
    res.status(200).send({ message: "Vendors retrieved successfully", data: vendors })
  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "Failed to retrieve vendors" })
  }
}

const getMyStore = async (req, res) => {
  try {
    const vendor = await VendorModel.findOne({ owner: req.user.id }).populate("owner", "firstName lastName email")

    if (!vendor) {
      res.status(404).send({ message: "You do not have a vendor profile" })
      return
    }

    res.status(200).send({ message: "Store retrieved successfully", data: vendor })
  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "Failed to retrieve store" })
  }
}

module.exports = { applyAsVendor, approveVendor, rejectVendor, getAllVendors, getMyStore }