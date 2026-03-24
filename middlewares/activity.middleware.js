const ActivityModel = require("../models/activity.model")

const logActivity = (action, riskLevel = "low") => {
  return async (req, res, next) => {
    const originalSend = res.send.bind(res)
    res.send = async function (body) {
      try {
        const status = res.statusCode >= 200 && res.statusCode < 300
          ? "success"
          : "failed"

        await ActivityModel.create({
          user: req.user.id,
          action,
          endpoint: req.originalUrl,
          method: req.method,
          ipAddress: req.ip || req.connection.remoteAddress,
          status,
          riskLevel,
        })
      } catch (error) {
        console.log("Activity log error:", error)
      }
      return originalSend(body)
    }

    next()
  }
}

module.exports = { logActivity }