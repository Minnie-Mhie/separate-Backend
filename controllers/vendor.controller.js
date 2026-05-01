const axios       = require("axios")
const VendorModel = require("../models/vendor.model")
const UserModel   = require("../models/user.model")
const cloudinary  = require("cloudinary").v2
const nodemailer  = require("nodemailer")
const mailSender  = require("../middlewares/mailer")

cloudinary.config({
  api_key:    process.env.CLOUD_KEY,
  cloud_name: process.env.CLOUD_NAME,
  api_secret: process.env.CLOUD_SECRET,
})

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

const COMMISSION_RATE = 0.10

const applyAsVendor = async (req, res) => {
  const {
    storeName,
    storeDescription,
    bvn,
    nin,
    houseAddress,
    bankName,
    accountNumber,
    accountName,
    passportPhoto,
    businessCertificate,
  } = req.body

  try {
    const existingApplication = await VendorModel.findOne({ owner: req.user.id })
    if (existingApplication) {
      res.status(400).send({ message: "You have already submitted a vendor application" })
      return
    }

    let passportImage     = { public_id: "", secure_url: "" }
    let certificateImage  = { public_id: "", secure_url: "" }

    if (passportPhoto) {
      const result = await cloudinary.uploader.upload(passportPhoto, {
        folder: "vendor_kyc/passports",
      })
      passportImage = { public_id: result.public_id, secure_url: result.secure_url }
    }

    if (businessCertificate) {
      const result = await cloudinary.uploader.upload(businessCertificate, {
        folder: "vendor_kyc/certificates",
      })
      certificateImage = { public_id: result.public_id, secure_url: result.secure_url }
    }

    const vendor = await VendorModel.create({
      storeName,
      storeDescription,
      owner:               req.user.id,
      bvn,
      nin,
      houseAddress,
      bankName,
      accountNumber,
      accountName,
      passportPhoto:       passportImage,
      businessCertificate: certificateImage,
    })

    await UserModel.findByIdAndUpdate(req.user.id, {
      roles:  "vendor",
      status: "pending",
    })

    res.status(201).send({
      message: "Vendor application submitted successfully. Await admin approval.",
      data:    vendor,
    })

    const isUser = await UserModel.findById(req.user.id)
    const renderMail = await mailSender("pendingVendor.ejs", {
      firstName: isUser.firstName,
      storeName: vendor.storeName,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      isUser.email,
      subject: `Application Received, ${isUser.firstName}!`,
      html:    renderMail,
    })

  } catch (error) {
    console.log(error)
    if (error.code === 11000) {
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

    let subaccountCode = vendor.paystackSubaccountCode

    if (!subaccountCode) {
      try {
        const paystackRes = await axios.post(
          "https://api.paystack.co/subaccount",
          {
            business_name:     vendor.storeName,
            settlement_bank:   vendor.bankName,
            account_number:    vendor.accountNumber,
            percentage_charge: COMMISSION_RATE * 100,
          },
          {
            headers: {
              Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        )
        subaccountCode = paystackRes.data.data.subaccount_code
      } catch (paystackError) {
        console.log("Paystack subaccount error:", paystackError.response?.data || paystackError.message)
      }
    }

    await VendorModel.findByIdAndUpdate(id, {
      status:                 "approved",
      paystackSubaccountCode: subaccountCode || "",
    })

    await UserModel.findByIdAndUpdate(vendor.owner, { status: "active" })

    res.status(200).send({ message: "Vendor approved successfully" })

    const isUser = await UserModel.findById(vendor.owner)
    const renderMail = await mailSender("approveVendor.ejs", {
      firstName: isUser.firstName,
      storeName: vendor.storeName,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      isUser.email,
      subject: `Application Approved, ${isUser.firstName}!`,
      html:    renderMail,
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
    await UserModel.findByIdAndUpdate(vendor.owner, {
      roles:  "user",
      status: "active",
    })

    res.status(200).send({ message: "Vendor application rejected" })

    const isUser = await UserModel.findById(vendor.owner)
    const renderMail = await mailSender("rejectVendor.ejs", {
      firstName: isUser.firstName,
      storeName: vendor.storeName,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      isUser.email,
      subject: `Application Update, ${isUser.firstName}`,
      html:    renderMail,
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to reject vendor" })
  }
}

const getAllVendors = async (req, res) => {
  try {
    const vendors = await VendorModel.find()
      .populate("owner", "firstName lastName email status")

    res.status(200).send({
      message: "Vendors retrieved successfully",
      data:    vendors,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "Failed to retrieve vendors" })
  }
}

const getMyStore = async (req, res) => {
  try {
    const vendor = await VendorModel.findOne({ owner: req.user.id })
      .populate("owner", "firstName lastName email")

    if (!vendor) {
      res.status(404).send({ message: "You do not have a vendor profile" })
      return
    }

    res.status(200).send({
      message: "Store retrieved successfully",
      data:    vendor,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({ message: "Failed to retrieve store" })
  }
}

module.exports = {
  applyAsVendor,
  approveVendor,
  rejectVendor,
  getAllVendors,
  getMyStore,
}