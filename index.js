// const express = require("express")
// const app = express()
// const mongoose = require("mongoose")
// const cors = require("cors")
// const dotenv = require("dotenv")
// dotenv.config()

// app.use(express.urlencoded({ extended: true }))
// app.use(express.json({ limit: "50mb" }))


// app.use(cors({
//   origin: "*",
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }))

// const UserRouter    = require("./routers/user.routes")
// const ProductRouter = require("./routers/product.routes")
// const VendorRouter  = require("./routers/vendor.routes")
// const CartRouter    = require("./routers/cart.routes")
// const OrderRouter   = require("./routers/order.routes")
// const KycRouter     = require("./routers/kyc.routes")
// const ContactRouter = require("./routers/contact.routes")

// app.use("/api/v1", UserRouter)
// app.use("/api/v1", ProductRouter)
// app.use("/api/v1", VendorRouter)
// app.use("/api/v1", CartRouter)
// app.use("/api/v1", OrderRouter)
// app.use("/api/v1", KycRouter)
// app.use("/api/v1", ContactRouter)

// app.get("/", (req, res) => {
//   res.send("Nana's Pourfection Hub API is running")
// })

// mongoose.connect(process.env.DATABASE_URI)
//   .then(() => {
//     console.log("Database connected successfully")
//   })
//   .catch(() => {
//     console.log("Failed to connect to DB")
//   })

// module.exports = app

const express = require("express")
const app = express()
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
dotenv.config()

app.use(express.urlencoded({ extended: true }))
app.use(express.json({ limit: "50mb" }))

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))

const UserRouter    = require("./routers/user.routes")
const ProductRouter = require("./routers/product.routes")
const VendorRouter  = require("./routers/vendor.routes")
const CartRouter    = require("./routers/cart.routes")
const OrderRouter   = require("./routers/order.routes")
const KycRouter     = require("./routers/kyc.routes")
const ContactRouter = require("./routers/contact.routes")

app.get("/", (req, res) => {
  res.send("Nana's Pourfection Hub API is running")
})

app.use("/api/v1", UserRouter)
app.use("/api/v1", ProductRouter)
app.use("/api/v1", VendorRouter)
app.use("/api/v1", CartRouter)
app.use("/api/v1", OrderRouter)
app.use("/api/v1", KycRouter)
app.use("/api/v1", ContactRouter)

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
})

mongoose.connect(process.env.DATABASE_URI)
  .then(() => console.log("Database connected successfully"))
  .catch(() => console.log("Failed to connect to DB"))


module.exports = app