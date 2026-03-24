const express = require("express");
const serverless = require("serverless-http");
const app = express();
const ejs = require('ejs')
const mongoose = require("mongoose")
const cors = require("cors")
app.set("view engine", 'ejs')
const dotenv = require("dotenv");
dotenv.config();

app.use(express.urlencoded({extended:true}))
app.use(express.json({limit:"50mb"}))
app.use(cors())


const UserRouter = require("./routers/user.routes")
const ProductRouter = require("./routers/product.routes")
const VendorRouter = require("./routers/vendor.routes")
const CartRouter = require("./routers/cart.routes")
const OrderRouter = require("./routers/order.routes")
const KycRouter = require("./routers/kyc.routes");
const ContactRouter = require("./routers/contact.routes")



app.use('/api/v1', UserRouter)
app.use("/api/v1", ProductRouter)
app.use("/api/v1", VendorRouter)
app.use("/api/v1", CartRouter)
app.use("/api/v1", OrderRouter)
app.use("/api/v1", KycRouter)
app.use("/api/v1", ContactRouter)

mongoose.connect(process.env.DATABASE_URI)
.then(()=>{
  console.log("Database connected successfully");
  
})
.catch(()=>{
  console.log("Failed to connect to DB");
  
})

app.get("/api/hello", (req, res)=>{
  res.send("Hello from backend");
});


const products = [
  {
    prodName: "charger",
    prodPrice: 20,
    prodQuantity: 15,
    prodDescription: "Fast charging USB-C wall charger",
  },
  {
    prodName: "wireless earbuds",
    prodPrice: 89.99,
    prodQuantity: 42,
    prodDescription: "Noise-cancelling Bluetooth earbuds with charging case",
  },
  {
    prodName: "laptop stand",
    prodPrice: 34.5,
    prodQuantity: 28,
    prodDescription: "Adjustable aluminum laptop stand for ergonomic setup",
  },
  {
    prodName: "mechanical keyboard",
    prodPrice: 119.99,
    prodQuantity: 17,
    prodDescription: "RGB mechanical keyboard with Cherry MX switches",
  },
  {
    prodName: "smart watch",
    prodPrice: 249.99,
    prodQuantity: 8,
    prodDescription: "Fitness tracker with heart rate monitor and GPS",
  },
  {
    prodName: "webcam",
    prodPrice: 75.25,
    prodQuantity: 56,
    prodDescription: "1080p HD webcam with built-in microphone",
  },
  {
    prodName: "power bank",
    prodPrice: 45.99,
    prodQuantity: 33,
    prodDescription: "20000mAh portable power bank with multiple ports",
  },
  {
    prodName: "desk lamp",
    prodPrice: 29.99,
    prodQuantity: 21,
    prodDescription:
      "LED desk lamp with adjustable brightness and color temperature",
  },
  {
    prodName: "external SSD",
    prodPrice: 129.99,
    prodQuantity: 12,
    prodDescription: "1TB USB 3.2 external solid state drive",
  },
  {
    prodName: "gaming mouse",
    prodPrice: 59.95,
    prodQuantity: 39,
    prodDescription: "Programmable gaming mouse with RGB lighting",
  },
];
app.get("/", (req, res) => {
  // res.send(true)
  // res.send(['pampam', 'nony', ])
  //   res.send(products)

  console.log(__dirname);
  res.sendFile(__dirname + "/index.html");
});

app.get('/index', (req, res)=>{
  res.render('index', {products})
})

app.get('/addProduct', (req, res)=>{
  res.render("addProduct")
})

app.post("/addProduct", (req, res)=>{
    console.log(req.body)
    const{prodName, prodPrice, prodQuantity, prodDescription} = req.body

    products.push(req.body)
    res.render("index", {products})
})

app.post("/deleteProd/:id", (req, res)=>{
  console.log(req.params);
  const {id}= req.params
  products.splice(id,1)
  res.render("index", {products})
  
  
})

app.get("/editProd/:id", (req, res)=>{
  res.render("editProduct")
})

app.post("/editProd/:id", (req, res)=>{
  const {id}= req.params
  const{prodName, prodPrice, prodQuantity, prodDescription} = req.body
  products.splice(id, 1, req.body)
  res.render("index", {products})
})


// app.listen(process.env.PORT, (err) => {
//   if (err) {
//     console.log("error starting server", err);
//   } else {
//     console.log(`server started successfully`);
//   }
// });

module.exports = app;
module.exports.handler = serverless(app);
