const mongoose = require("mongoose")

const ActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  action: { type: String, required: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  ipAddress: { type: String, required: true },
  status: { type: String, enum: ["success", "failed"], required: true },
  riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
}, { timestamps: true, strict: "throw" })

const ActivityModel = mongoose.model("activity", ActivitySchema)

module.exports = ActivityModel