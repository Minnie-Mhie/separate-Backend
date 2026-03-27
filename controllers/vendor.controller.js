const VendorModel = require("../models/vendor.model");
const UserModel = require("../models/user.model");
const nodemailer = require("nodemailer");
const mailSender = require("../middlewares/mailer");

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS
  }
});

const applyAsVendor = async (req, res) => {
  const { storeName, storeDescription } = req.body;

  try {
    const existingApplication = await VendorModel.findOne({ owner: req.user.id });
    if (existingApplication) {
      return res.status(400).send({ message: "You have already submitted a vendor application" });
    }
    const vendor = await VendorModel.create({
      storeName,
      storeDescription,
      owner: req.user.id,
    });

    const user = await UserModel.findByIdAndUpdate(
      req.user.id, 
      { roles: "vendor", status: "pending" }, 
      { new: true }
    );

    res.status(201).send({
      message: "Application submitted. Awaiting admin approval.",
      data: vendor,
    });

    const vendorMail = await mailSender("pendingVendor.ejs", { firstName: user.firstName, storeName: vendor.storeName });
  
    transporter.sendMail({
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: user.email,
      subject: "Application Received!",
      html: vendorMail,
    });
    transporter.sendMail({
      from: `"System Alert" <${process.env.NODE_MAIL}>`,
      to: process.env.ADMIN_EMAIL, 
      subject: "New Vendor Alert",
      text: `New vendor application from ${user.firstName} for store: ${vendor.storeName}.`,
    });

  } catch (error) {
    console.error(error);
    const msg = error.code === 11000 ? "Store name already exists" : "Application failed";
    res.status(400).send({ message: msg });
  }
};

const approveVendor = async (req, res) => {
  const { id } = req.params;

  try {
    const vendor = await VendorModel.findById(id);
    if (!vendor) return res.status(404).send({ message: "Application not found" });

    await VendorModel.findByIdAndUpdate(id, { status: "approved" });
    const user = await UserModel.findByIdAndUpdate(vendor.owner, { status: "active" }, { new: true });

    res.status(200).send({ message: "Vendor approved successfully" });

    const approveMail = await mailSender("approveVendor.ejs", { firstName: user.firstName, storeName: vendor.storeName });
    transporter.sendMail({
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: user.email,
      subject: "Congratulations! Your Store is Live",
      html: approveMail,
    });

  } catch (error) {
    res.status(400).send({ message: "Approval failed" });
  }
};

const rejectVendor = async (req, res) => {
  const { id } = req.params;

  try {
    const vendor = await VendorModel.findById(id);
    if (!vendor) return res.status(404).send({ message: "Application not found" });

    await VendorModel.findByIdAndUpdate(id, { status: "rejected" });
    const user = await UserModel.findByIdAndUpdate(vendor.owner, { roles: "user", status: "active" }, { new: true });

    res.status(200).send({ message: "Vendor application rejected" });

    const rejectMail = await mailSender("rejectVendor.ejs", { firstName: user.firstName, storeName: vendor.storeName });
    transporter.sendMail({
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: user.email,
      subject: "Application Update",
      html: rejectMail,
    });

  } catch (error) {
    res.status(400).send({ message: "Rejection failed" });
  }
};

const getAllVendors = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const vendors = await VendorModel.find(filter).populate("owner", "firstName lastName email status");
    res.status(200).send({ data: vendors });
  } catch (error) {
    res.status(404).send({ message: "Failed to retrieve vendors" });
  }
};

const getMyStore = async (req, res) => {
  try {
    const vendor = await VendorModel.findOne({ owner: req.user.id }).populate("owner", "firstName lastName email");
    if (!vendor) return res.status(404).send({ message: "No vendor profile found" });
    res.status(200).send({ data: vendor });
  } catch (error) {
    res.status(404).send({ message: "Error retrieving store" });
  }
};

module.exports = { applyAsVendor, approveVendor, rejectVendor, getAllVendors, getMyStore };
