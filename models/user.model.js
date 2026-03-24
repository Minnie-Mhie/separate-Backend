const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: { type: String, enum: ['user', 'admin', 'vendor'], default: "user" },
  status: { type: String, enum: ['active', 'suspended', 'pending'], default: "active" },
}, { timestamps: true, strict: "throw" })

const UserModel = mongoose.model("user", UserSchema)

module.exports = UserModel
