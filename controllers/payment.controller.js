const axios = require("axios")
const CartModel = require("../models/cart.model")
const ProductModel = require("../models/product.model")
const VendorModel = require("../models/vendor.model")
const OrderModel = require("../models/order.model")
const UserModel = require("../models/user.model")
const mailSender = require("../middlewares/mailer")
const nodemailer = require("nodemailer")

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS
  }
})

const initializePayment = async (req, res) => {
  const { street, city, state, country } = req.body

  try {
    const isUser = await UserModel.findById(req.user.id)

    const cart = await CartModel.findOne({ user: req.user.id }).populate("items.product")

    if (!cart || cart.items.length === 0) {
      res.status(400).send({ message: "Your cart is empty" })
      return
    }

    let totalAmount = 0

    for (let item of cart.items) {
      const product = item.product

      if (product.status !== "approved") {
        res.status(400).send({ message: `${product.productName} is no longer available` })
        return
      }

      if (item.quantity > product.productQuantity) {
        res.status(400).send({
          message: `Not enough stock for ${product.productName}. Only ${product.productQuantity} left.`,
        })
        return
      }

      totalAmount += product.productPrice * item.quantity
    }

    const amountInKobo = Math.round(totalAmount * 100)

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: isUser.email,
        amount: amountInKobo,
        callback_url: `${process.env.FRONTEND_URL}/orders`,
        metadata: {
          userId: req.user.id,
          shippingAddress: { street, city, state, country },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    res.status(200).send({
      message: "Payment initialized",
      data: {
        authorization_url: paystackResponse.data.data.authorization_url,
        reference: paystackResponse.data.data.reference,
      },
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to initialize payment" })
  }
}

const verifyPayment = async (req, res) => {
  const { reference } = req.params

  try {
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const transaction = paystackResponse.data.data

    if (transaction.status !== "success") {
      res.status(400).send({ message: "Payment was not successful" })
      return
    }

    const existingOrder = await OrderModel.findOne({ paystackReference: reference })
    if (existingOrder) {
      res.status(200).send({ message: "Order already created", data: existingOrder })
      return
    }

    const { userId, shippingAddress } = transaction.metadata

    const cart = await CartModel.findOne({ user: userId }).populate("items.product")

    if (!cart || cart.items.length === 0) {
      res.status(400).send({ message: "Cart is empty or already processed" })
      return
    }

    let totalAmount = 0
    const orderItems = []

    for (let item of cart.items) {
      const product = item.product

      if (item.quantity > product.productQuantity) {
        res.status(400).send({
          message: `Not enough stock for ${product.productName}`,
        })
        return
      }

      const vendorEarnings = parseFloat((product.vendorPrice * item.quantity).toFixed(2))
      const platformCommission = parseFloat(((product.productPrice - product.vendorPrice) * item.quantity).toFixed(2))

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        priceAtOrder: product.productPrice,
        vendorEarnings,
        platformCommission,
      })

      totalAmount += product.productPrice * item.quantity
    }

    const order = await OrderModel.create({
      user: userId,
      items: orderItems,
      totalAmount,
      paystackReference: reference,
      shippingAddress,
    })

    for (let item of cart.items) {
      await ProductModel.findByIdAndUpdate(item.product._id, {
        $inc: { productQuantity: -item.quantity },
      })
    }

    cart.items = []
    await cart.save()

    res.status(201).send({ message: "Order placed successfully", data: order })

    const isUser = await UserModel.findById(userId)
    const populatedOrder = await OrderModel.findById(order._id).populate("items.product")

    const renderMail = await mailSender("orderMail.ejs", {
      firstName: isUser.firstName,
      orderId: populatedOrder._id,
      items: populatedOrder.items.map(i => ({
        name: i.product.productName,
        quantity: i.quantity,
        price: i.priceAtOrder,
      })),
      totalAmount: populatedOrder.totalAmount,
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: isUser.email,
      subject: `Order Confirmed, ${isUser.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) { console.log(error) }
      else { console.log('Email sent: ' + info.response) }
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Payment verification failed" })
  }
}

const getBanks = async (req, res) => {
  try {
    const response = await axios.get("https://api.paystack.co/bank?currency=NGN", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    res.status(200).send({
      message: "Banks retrieved successfully",
      data: response.data.data,
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to retrieve banks" })
  }
}

module.exports = { initializePayment, verifyPayment, getBanks }