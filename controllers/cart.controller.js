const CartModel = require("../models/cart.model")
const ProductModel = require("../models/product.model")

const addToCart = async (req, res) => {
  const { productId, quantity } = req.body

  try {
    const product = await ProductModel.findById(productId)

    if (!product) {
      res.status(404).send({
        message: "Product not found",
      })
      return
    }

    if (product.status !== "approved") {
      res.status(400).send({
        message: "This product is not available",
      })
      return
    }
    if (quantity > product.productQuantity) {
      res.status(400).send({
        message: `Only ${product.productQuantity} items available in stock`,
      })
      return
    }

    let cart = await CartModel.findOne({ user: req.user.id })

    if (!cart) {
      cart = await CartModel.create({
        user: req.user.id,
        items: [{ product: productId, quantity }],
      })
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      )

      if (itemIndex > -1) {
        
        cart.items[itemIndex].quantity += quantity
      } else
        cart.items.push({ product: productId, quantity })
      }

      await cart.save()
    await cart.populate("items.product", "productName productPrice productImage vendor")

    res.status(200).send({
      message: "Product added to cart",
      data: cart,
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to add product to cart",
    })
  }
}
const getMyCart = async (req, res) => {
  try {
    const cart = await CartModel.findOne({ user: req.user.id }).populate(
      "items.product",
      "productName productPrice productImage vendor status"
    )

    if (!cart) {
      res.status(200).send({
        message: "Your cart is empty",
        data: { items: [] },
      })
      return
    }

    let total = 0
    cart.items.forEach((item) => {
      total += item.product.productPrice * item.quantity
    })

    res.status(200).send({
      message: "Cart retrieved successfully",
      data: cart,
      total,
    })
  } catch (error) {
    console.log(error)
    res.status(404).send({
      message: "Failed to retrieve cart",
    })
  }
}

const updateCartItem = async (req, res) => {
  const { productId, quantity } = req.body

  try {
    const cart = await CartModel.findOne({ user: req.user.id })

    if (!cart) {
      res.status(404).send({
        message: "Cart not found",
      })
      return
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    )

    if (itemIndex === -1) {
      res.status(404).send({
        message: "Product not found in cart",
      })
      return
    }
    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1)
    } else {
      cart.items[itemIndex].quantity = quantity
    }

    await cart.save()
    await cart.populate("items.product", "productName productPrice productImage")

    res.status(200).send({
      message: "Cart updated successfully",
      data: cart,
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to update cart",
    })
  }
}

const removeFromCart = async (req, res) => {
  const { productId } = req.params

  try {
    const cart = await CartModel.findOne({ user: req.user.id })

    if (!cart) {
      res.status(404).send({
        message: "Cart not found",
      })
      return
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    )

    if (itemIndex === -1) {
      res.status(404).send({
        message: "Product not found in cart",
      })
      return
    }

    cart.items.splice(itemIndex, 1)
    await cart.save()

    res.status(200).send({
      message: "Product removed from cart",
      data: cart,
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to remove product from cart",
    })
  }
}

const clearCart = async (req, res) => {
  try {
    const cart = await CartModel.findOne({ user: req.user.id })

    if (!cart) {
      res.status(404).send({
        message: "Cart not found",
      })
      return
    }

    cart.items = []
    await cart.save()

    res.status(200).send({
      message: "Cart cleared successfully",
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      message: "Failed to clear cart",
    })
  }
}

module.exports = {
  addToCart,
  getMyCart,
  updateCartItem,
  removeFromCart,
  clearCart,
}