const OrderModel = require("../models/order.model")
const CartModel = require("../models/cart.model")
const ProductModel = require("../models/product.model")
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

const placeOrder = async (req, res) => {
  const { street, city, state, country } = req.body

  try {
    const cart = await CartModel.findOne({ user: req.user.id }).populate(
      "items.product"
    )

    if (!cart || cart.items.length === 0) {
      res.status(400).send({
        message: "Your cart is empty",
      })
      return
    }
    let totalAmount = 0
    const orderItems = []

    for (let item of cart.items) {
      const product = item.product

      if (item.quantity > product.productQuantity) {
        res.status(400).send({
          message: `Not enough stock for ${product.productName}. Only ${product.productQuantity} left.`,
        })
        return
      }

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        priceAtOrder: product.productPrice,
      })

      totalAmount += product.productPrice * item.quantity
    }

    const order = await OrderModel.create({
      user: req.user.id,
      items: orderItems,
      totalAmount,
      shippingAddress: { street, city, state, country },
    })
    for (let item of cart.items) {
      await ProductModel.findByIdAndUpdate(item.product._id, {
        $inc: { productQuantity: -item.quantity },
      })
    }
    cart.items = []
    await cart.save()

    res.status(201).send({
      message: "Order placed successfully",
      data: order,
    })

const isUser = await UserModel.findById(req.user.id)
const email = isUser.email
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
  to: email,
  subject: `Order Confirmed, ${isUser.firstName}!`,
  html: renderMail,
}

transporter.sendMail(mailOptions, function(error, info) {
  if (error) {
    console.log(error)
  } else {
    console.log('Email sent: ' + info.response)
  }
})
    

  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to place order",
    })
  }
}

const getMyOrders = async (req, res) => {
  try {
    const orders = await OrderModel.find({ user: req.user.id })
      .populate("items.product", "productName productPrice productImage")
      .sort({ createdAt: -1 })

    res.status(200).send({
      message: "Orders retrieved successfully",
      data: orders,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve orders",
    })
  }
}
const cancelOrder = async (req, res) => {
  const { id } = req.params

  try {
    const order = await OrderModel.findById(id)

    if (!order) {
      res.status(404).send({
        message: "Order not found",
      })
      return
    }

    if (order.user.toString() !== req.user.id) {
      res.status(403).send({
        message: "You are not authorized to cancel this order",
      })
      return
    }

    if (order.status !== "pending") {
      res.status(400).send({
        message: `Order cannot be cancelled. Current status: ${order.status}`,
      })
      return
    }
    for (let item of order.items) {
      await ProductModel.findByIdAndUpdate(item.product, {
        $inc: { productQuantity: item.quantity },
      })
    }

    await OrderModel.findByIdAndUpdate(id, { status: "cancelled" })

    res.status(200).send({
      message: "Order cancelled successfully",
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to cancel order",
    })
  }
}

const getAllOrders = async (req, res) => {
  try {
    const orders = await OrderModel.find()
      .populate("user", "firstName lastName email")
      .populate("items.product", "productName productPrice vendor")
      .sort({ createdAt: -1 })

    res.status(200).send({
      message: "All orders retrieved successfully",
      data: orders,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve orders",
    })
  }
}

const updateOrderStatus = async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  try {
    const order = await OrderModel.findById(id)

    if (!order) {
      res.status(404).send({ message: "Order not found" })
      return
    }

    const vendorAllowedStatuses = ["processing", "shipped"]
    const adminAllowedStatuses  = ["processing", "shipped", "delivered", "cancelled"]

    if (req.user.roles === "vendor" && !vendorAllowedStatuses.includes(status)) {
      res.status(403).send({
        message: "Vendors can only update order status to processing or shipped",
      })
      return
    }

    if (req.user.roles === "admin" && !adminAllowedStatuses.includes(status)) {
      res.status(400).send({
        message: "Invalid status",
      })
      return
    }

    await OrderModel.findByIdAndUpdate(id, { status })

    res.status(200).send({
      message: `Order status updated to ${status}`,
    })

  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to update order status",
    })
  }
}

const getVendorOrders = async (req, res) => {
  try {
    const vendorProducts = await ProductModel.find({ createdBy: req.user.id }).select("_id")
    const vendorProductIds = vendorProducts.map((p) => p._id.toString())

    // Find all orders that contain at least one of the vendor's products
    const orders = await OrderModel.find()
      .populate("user", "firstName lastName email")
      .populate("items.product", "productName productPrice productImage")
      .sort({ createdAt: -1 })

    const vendorOrders = orders
      .map((order) => {
        const relevantItems = order.items.filter((item) =>
          vendorProductIds.includes(item.product._id.toString())
        )
        if (relevantItems.length === 0) return null

        return {
          _id: order._id,
          user: order.user,
          status: order.status,
          shippingAddress: order.shippingAddress,
          createdAt: order.createdAt,
          items: relevantItems,
        }
      })
      .filter((order) => order !== null)

    res.status(200).send({
      message: "Vendor orders retrieved successfully",
      data: vendorOrders,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve vendor orders",
    })
  }
}

module.exports = {
  placeOrder,
  getMyOrders,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getVendorOrders,
}