const PlatformSettingsModel = require("../models/platformSettings.model")

const getSettings = async (req, res) => {
  try {
    let settings = await PlatformSettingsModel.findOne()

    if (!settings) {
      settings = await PlatformSettingsModel.create({ commissionRate: 10 })
    }

    res.status(200).send({
      message: "Platform settings retrieved successfully",
      data: settings,
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to retrieve platform settings" })
  }
}

const updateCommissionRate = async (req, res) => {
  const { commissionRate } = req.body

  try {
    if (commissionRate < 0 || commissionRate > 100) {
      res.status(400).send({ message: "Commission rate must be between 0 and 100" })
      return
    }

    let settings = await PlatformSettingsModel.findOne()

    if (!settings) {
      settings = await PlatformSettingsModel.create({ commissionRate })
    } else {
      await PlatformSettingsModel.findByIdAndUpdate(settings._id, { commissionRate })
    }

    res.status(200).send({ message: "Commission rate updated successfully" })
  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Failed to update commission rate" })
  }
}

module.exports = { getSettings, updateCommissionRate }