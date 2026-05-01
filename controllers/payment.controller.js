const axios        = require("axios")
const OrderModel   = require("../models/order.model")
const CartModel    = require("../models/cart.model")
const ProductModel = require("../models/product.model")
const UserModel    = require("../models/user.model")
const mailSender   = require("../middlewares/mailer")
const nodemailer   = require("nodemailer")

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

const buildSplitPayload = (items) => {
  const vendorMap = {}

  for (const item of items) {
    const subaccountCode = item.product?.vendor?.paystackSubaccountCode
    if (!subaccountCode) continue

    const baseAmount = item.product.basePrice * item.quantity
    if (vendorMap[subaccountCode]) {
      vendorMap[subaccountCode] += baseAmount
    } else {
      vendorMap[subaccountCode] = baseAmount
    }
  }

  const subaccounts = Object.entries(vendorMap).map(([code, amount]) => ({
    subaccount: code,
    share:      Math.floor(amount),
  }))

  if (subaccounts.length === 0) return null

  return {
    type:        "flat",
    bearer_type: "all-proportional",
    subaccounts,
  }
}

const initializePayment = async (req, res) => {
  const { email, amount, shippingAddress } = req.body

  try {
    const cart = await CartModel.findOne({ user: req.user.id }).populate({
      path:     "items.product",
      populate: { path: "vendor", select: "storeName paystackSubaccountCode" },
    })

    if (!cart || cart.items.length === 0) {
      res.status(400).send({ message: "Cart is empty" })
      return
    }

    const splitPayload = buildSplitPayload(cart.items)

    const paystackBody = {
      email,
      amount:   amount * 100,
      currency: "NGN",
      metadata: {
        userId:          req.user.id,
        shippingAddress: JSON.stringify(shippingAddress),
      },
      callback_url: `${process.env.FRONTEND_URL}/orders`,
    }

    if (splitPayload) {
      paystackBody.split = splitPayload
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      paystackBody,
      {
        headers: {
          Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    res.status(200).send({
      message:           "Payment initialized",
      authorization_url: response.data.data.authorization_url,
      reference:         response.data.data.reference,
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to initialize payment" })
  }
}

const verifyPayment = async (req, res) => {
  const { reference } = req.params

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const data = response.data.data

    if (data.status !== "success") {
      res.status(400).send({ message: "Payment was not successful" })
      return
    }

    const metadata        = data.metadata
    const userId          = metadata.userId
    const shippingAddress = JSON.parse(metadata.shippingAddress)

    const cart = await CartModel.findOne({ user: userId }).populate({
      path:     "items.product",
      populate: { path: "vendor", select: "storeName owner paystackSubaccountCode" },
    })

    if (!cart || cart.items.length === 0) {
      res.status(400).send({ message: "Cart is empty" })
      return
    }

    const orderItems = cart.items.map(item => ({
      product:      item.product._id,
      quantity:     item.quantity,
      priceAtOrder: item.product.productPrice,
      basePrice:    item.product.basePrice,
    }))

    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + item.product.productPrice * item.quantity
    }, 0)

    const order = await OrderModel.create({
      user:             userId,
      items:            orderItems,
      totalAmount,
      shippingAddress,
      status:           "pending",
      paymentReference: reference,
      paymentStatus:    "paid",
    })

    for (const item of cart.items) {
      await ProductModel.findByIdAndUpdate(item.product._id, {
        $inc: { productQuantity: -item.quantity },
      })
    }

    await CartModel.findOneAndUpdate({ user: userId }, { items: [] })

    res.status(200).send({
      message: "Payment verified and order placed successfully",
      data:    order,
    })

    const buyer = await UserModel.findById(userId)

    const buyerMail = await mailSender("orderMail.ejs", {
      firstName:   buyer.firstName,
      orderId:     order._id,
      items:       cart.items,
      totalAmount,
    })

    sendMail({
      from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to:      buyer.email,
      subject: `Order Confirmed — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    buyerMail,
    })

    const vendorIds = [...new Set(
      cart.items
        .map(item => item.product?.vendor?.owner?.toString())
        .filter(Boolean)
    )]

    for (const vendorUserId of vendorIds) {
      const vendorUser = await UserModel.findById(vendorUserId)
      if (!vendorUser) continue

      const vendorItems = cart.items.filter(
        item => item.product?.vendor?.owner?.toString() === vendorUserId
      )

      const vendorTotal = vendorItems.reduce(
        (s, i) => s + i.product.basePrice * i.quantity, 0
      )

      const vendorMail = await mailSender("vendorOrderNotification.ejs", {
        firstName:     vendorUser.firstName,
        orderId:       order._id,
        items:         vendorItems,
        totalAmount:   vendorTotal,
        customerName:  `${buyer.firstName} ${buyer.lastName}`,
        customerEmail: buyer.email,
      })

      sendMail({
        from:    `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
        to:      vendorUser.email,
        subject: `New Order Received — #${order._id.toString().slice(-8).toUpperCase()}`,
        html:    vendorMail,
      })
    }

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Payment verification failed" })
  }
}

module.exports = { initializePayment, verifyPayment }