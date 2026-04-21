const ProductModel = require("../models/product.model")
const VendorModel = require("../models/vendor.model")
const UserModel = require("../models/user.model")
const cloudinary = require("cloudinary").v2
const nodemailer = require("nodemailer");
const mailSender = require("../middlewares/mailer");

cloudinary.config({
  api_key: process.env.CLOUD_KEY,
  cloud_name: process.env.CLOUD_NAME,
  api_secret: process.env.CLOUD_SECRET,
});

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS
  }
});

const listProduct = async (req, res) => {
  const { productName, productPrice: vendorPrice, productQuantity, productDescription, productImage, category, videoUrl } = req.body

  try {
    const vendorProfile = await VendorModel.findOne({ owner: req.user.id })

    if (req.user.roles !== "admin") {
      if (!vendorProfile) {
        res.status(403).send({ message: "You do not have a vendor profile" })
        return
      }
      if (vendorProfile.status !== "approved") {
        res.status(403).send({ message: "Your vendor account is not yet approved" })
        return
      }
    }

    if (!vendorProfile) {
      res.status(403).send({ message: "Admin vendor profile not found." })
      return
    }

    const settings = await PlatformSettingsModel.findOne()
    const commissionRate = settings ? settings.commissionRate : 0
    const productPrice = parseFloat((vendorPrice * (1 + commissionRate / 100)).toFixed(2))

    const result = await cloudinary.uploader.upload(productImage)
    const image = {
      public_id: result.public_id,
      secure_url: result.secure_url,
    }

    const product = await ProductModel.create({
      productName,
      productPrice,
      vendorPrice,
      commissionRate,
      productQuantity,
      productDescription,
      productImage: image,
      category,
      videoUrl: videoUrl || "",
      createdBy: req.user.id,
      vendor: vendorProfile._id,
      status: req.user.roles === "admin" ? "approved" : "pending",
    })

    res.status(201).send({
      message: req.user.roles === "admin"
        ? "Product added and is now live in the marketplace."
        : "Product submitted successfully. Awaiting admin approval.",
      data: product,
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Error adding product" })
  }
}

const approveProduct = async (req, res) => {
  const { id } = req.params

  try {
    const product = await ProductModel.findById(id)

    if (!product) {
      res.status(404).send({
        message: "Product not found",
      })
      return
    }

    await ProductModel.findByIdAndUpdate(id, { status: "approved" })

    res.status(200).send({
      message: "Product approved successfully",
    })
    const isUser = await UserModel.findById(product.createdBy)
    const email = isUser.email
    const renderMail = await mailSender("approveProduct.ejs", {
      firstName: isUser.firstName,
      productName: product.productName,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: email,
      subject: `Product Approved, ${isUser.firstName}!`,
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
      message: "Failed to approve product",
    })
  }
}

const rejectProduct = async (req, res) => {
  const { id } = req.params

  try {
    const product = await ProductModel.findById(id)

    if (!product) {
      res.status(404).send({
        message: "Product not found",
      })
      return
    }

    await ProductModel.findByIdAndUpdate(id, { status: "rejected" })

    res.status(200).send({
      message: "Product Rejected",
    })
    const isUser = await UserModel.findById(product.createdBy)
    const email = isUser.email
    const renderMail = await mailSender("rejectProduct.ejs", {
      firstName: isUser.firstName,
      productName: product.productName,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: email,
      subject: `Product Rejected, ${isUser.firstName}!`,
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
      message: "Failed to reject product",
    })
  }
}

const getProducts = async (req, res) => {
  try {
    const products = await ProductModel.find({ status: "approved" })
      .populate("createdBy", "firstName lastName email")
      .populate("vendor", "storeName")

    res.status(200).send({
      message: "Products fetched successfully",
      data: products,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to fetch products",
    })
  }
}

const getAllProducts = async (req, res) => {
  try {
    const products = await ProductModel.find()
      .populate("createdBy", "firstName lastName email")
      .populate("vendor", "storeName status")

    res.status(200).send({
      message: "All products fetched successfully",
      data: products,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to fetch products",
    })
  }
}

const getMyProducts = async (req, res) => {
  try {
    const vendorProfile = await VendorModel.findOne({ owner: req.user.id })

    if (!vendorProfile) {
      res.status(404).send({
        message: "Vendor profile not found",
      })
      return
    }

    const products = await ProductModel.find({ vendor: vendorProfile._id })
      .populate("createdBy", "firstName lastName email")

    res.status(200).send({
      message: "Your products fetched successfully",
      data: products,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to fetch your products",
    })
  }
}

const getProductsBy = async (req, res) => {
  const { productName, productPrice, createdBy } = req.query
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const skip = (page - 1) * limit

  try {
    const filter = {}

    if (productName)
      filter.productName = { $regex: productName, $options: "i" }

    if (productPrice)
      filter.productPrice = productPrice

    if (createdBy)
      filter.createdBy = createdBy

    const product = await ProductModel.find(filter)
      .populate("createdBy", "firstName lastName email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await ProductModel.countDocuments(filter)

    res.status(200).send({
      data: product,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total
      }
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "failed to fetch product"
    })
  }
}

const getCategories = async (req, res) => {
  try {
    const categories = await ProductModel.distinct("category", { status: "approved" })

    res.status(200).send({
      message: "Categories fetched successfully",
      data: categories,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to fetch categories",
    })
  }
}

const getProductsByCategory = async (req, res) => {
  const { category } = req.params

  try {
    const products = await ProductModel.find({
      status: "approved",
      category: { $regex: category, $options: "i" },
    })
      .populate("createdBy", "firstName lastName email")
      .populate("vendor", "storeName")
      .sort({ createdAt: -1 })

    res.status(200).send({
      message: `Products in ${category} fetched successfully`,
      total: products.length,
      data: products,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to fetch products by category",
    })
  }
}

const editProduct = async (req, res) => {
  const { id } = req.params
  const { productName, productPrice, productQuantity, productDescription, category, videoUrl, productImage } = req.body

  try {
    const product = await ProductModel.findById(id)

    if (!product) {
      res.status(404).send({ message: "Product not found" })
      return
    }

    if (product.createdBy.toString() !== req.user.id) {
      res.status(403).send({ message: "You are not authorized to edit this product" })
      return
    }

    let updatedImage = product.productImage

    if (productImage && productImage !== product.productImage.secure_url) {
      const result = await cloudinary.uploader.upload(productImage)
      updatedImage = {
        public_id: result.public_id,
        secure_url: result.secure_url,
      }
    }

    await ProductModel.findByIdAndUpdate(id, {
      productName,
      productPrice,
      productQuantity,
      productDescription,
      category,
      videoUrl: videoUrl || "",
      productImage: updatedImage,
      status: "pending",
    })

    res.status(200).send({ message: "Product updated successfully. Awaiting admin approval." })

    const isUser = await UserModel.findById(product.createdBy)
    const email = isUser.email
    const renderMail = await mailSender("pendingProduct.ejs", {
      firstName: isUser.firstName,
      productName: product.productName,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: email,
      subject: `Product Listing Received, ${isUser.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    })

    if (product.status === "approved") {
      const isUser = await UserModel.findById(product.createdBy)
      const email = isUser.email
      const renderMail = await mailSender("approveProduct.ejs", {
        firstName: isUser.firstName,
        productName: product.productName,
      })

      let mailOptions = {
        from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
        to: email,
        subject: `Product Approved, ${isUser.firstName}!`,
        html: renderMail,
      }

      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      })
    }
  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to update product" })
  }
}

module.exports = {
  listProduct,
  approveProduct,
  rejectProduct,
  getProducts,
  getAllProducts,
  getMyProducts,
  getProductsBy,
  getCategories,
  getProductsByCategory,
  editProduct,
}