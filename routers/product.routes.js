const express = require("express")
const {
  listProduct,
  approveProduct,
  rejectProduct,
  getProducts,
  getAllProducts,
  getMyProducts,
  getProductsBy,
  getCategories,
  getProductsByCategory,
  editProduct
} = require("../controllers/product.controller")
const { verifyUser, requireRole } = require("../controllers/user.controller")
const { logActivity } = require("../middlewares/activity.middleware")

const router = express.Router()

router.get("/products", getProducts)
router.get("/products/categories", getCategories)
router.get("/products/category/:category", getProductsByCategory)
router.get("/productsby/", verifyUser, getProductsBy)

router.post("/products/add", verifyUser, logActivity("Added a product", "low"), listProduct)
router.get("/products/mine", verifyUser, requireRole("vendor"), getMyProducts)

router.get("/products/all", verifyUser, requireRole("admin"), getAllProducts)
router.patch("/products/approve/:id", verifyUser, requireRole("admin"), logActivity("Approved a product", "low"), approveProduct)
router.patch("/products/reject/:id", verifyUser, requireRole("admin"), logActivity("Rejected a product", "medium"), rejectProduct)

router.patch("/products/edit/:id", verifyUser, editProduct)

module.exports = router