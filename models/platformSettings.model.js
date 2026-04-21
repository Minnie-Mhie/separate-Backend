const mongoose = require("mongoose")

const PlatformSettingsSchema = new mongoose.Schema({
  commissionRate: { type: Number, required: true, default: 10 },
}, { timestamps: true, strict: "throw" })

const PlatformSettingsModel = mongoose.model("platformSettings", PlatformSettingsSchema)

module.exports = PlatformSettingsModel