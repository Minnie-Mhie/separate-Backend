const UserModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mailSender = require("../middlewares/mailer");
const otpgen = require("otp-generator");
const OTPModel = require("../models/otp.model");

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODE_MAIL,
    pass: process.env.NODE_PASS
  }
});

const dns = require("dns").promises
const isRealEmail = async (email) => {
  const domain = email.split("@")[1]
  try {
    const records = await dns.resolveMx(domain)
    return records && records.length > 0
  } catch (error) {
    return false
  }
}

const createUser = async (req, res) => {
  const { lastName, email, password, firstName, roles } = req.body;

  const realEmail = await isRealEmail(email)
  if (!realEmail) {
    res.status(400).send({
      message: "Please provide a real email"
    })
    return 
  }

  try {
    const saltround = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, saltround);
    const status = roles === "vendor" ? "pending" : "active";

    const user = await UserModel.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      roles: roles || "user",
      status,
    });

    const renderMail = await mailSender("welcomeMail.ejs", { firstName })

    const token = await jwt.sign(
      { id: user._id, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: "30m" }
    );

    res.status(201).send({
      message: "user created successfully",
      data: {
        lastName,
        email,
        firstName,
        roles: user.roles,
        status: user.status,
      },
      token,
    });

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      subject: `Welcome ${firstName},`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

  } catch (error) {
    console.log(error);

    if (error.code == 11000) {
      res.status(400).send({
        message: "User already registered",
      });
    } else {
      res.status(400).send({
        message: "User creation failed",
      });
    }
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const isUser = await UserModel.findOne({ email });
    if (!isUser) {
      res.status(404).send({ message: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, isUser.password);
    if (!isMatch) {
      res.status(404).send({ message: "Invalid credentials" });
      return;
    }

    if (isUser.status === "suspended") {
      res.status(403).send({ message: "Your account has been suspended" });
      return;
    }

    if (isUser.roles === "vendor" && isUser.status === "pending") {
      res.status(403).send({ message: "Your vendor account is awaiting admin approval" });
      return;
    }

    const token = await jwt.sign(
      { id: isUser._id, roles: isUser.roles },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).send({
      message: "user logged in successfully",
      data: {
        email: isUser.email,
        roles: isUser.roles,
        status: isUser.status,
        firstName: isUser.firstName,
        lastName: isUser.lastName,
      },
      token,
    });

    const renderMail = await mailSender("loginMail.ejs", { firstName: isUser.firstName })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: email,
      subject: `Welcome back ${isUser.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    })

  } catch (error) {
    console.log(error);
    res.status(404).send({ message: "Invalid credentials" });
  }
};

const logout = async (req, res) => {
  try {
    const isUser = await UserModel.findById(req.user.id)
    if (!isUser) {
      res.status(404).send({ message: "User not found" })
      return
    }

    const renderMail = await mailSender("logOut.ejs", { firstName: isUser.firstName })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: isUser.email,
      subject: `You've been logged out ${isUser.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) { console.log(error) }
      else { console.log('Email sent: ' + info.response) }
    })

    res.status(200).send({ message: "logout successful" })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "user logout failed" })
  }
}

const editUser = async (req, res) => {
  const { firstName, lastName } = req.body;
  const { id } = req.params;

  try {
    let allowedUpdate = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
    };
    await UserModel.findByIdAndUpdate(id, allowedUpdate);
    res.status(200).send({
      message: "User updated successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      message: "User update failed",
    });
  }
};

const getAllUser = async (req, res) => {
  try {
    let users = await UserModel.find().select("-password");
    res.status(200).send({
      message: "users retrieved successfully",
      data: users,
    });
  } catch (error) {
    console.log(error);
    res.status(404).send({
      message: "users not found",
    });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const isDeleted = await UserModel.findByIdAndDelete(id);

    if (!isDeleted) {
      res.status(400).send({
        message: "user failed to delete",
      });
      return;
    }

    res.status(200).send({ // ✅ fixed: was 204 which sends no body
      message: "user deleted successfully",
    });

    // ✅ fixed: now uses isDeleted directly (the deleted user's data)
    // instead of fetching req.user.id which returns the admin
    const renderMail = await mailSender("deleteAccount.ejs", { // ✅ fixed: was "deleteUser.ejs"
      firstName: isDeleted.firstName,
      email: isDeleted.email, // ✅ fixed: was missing email
    })

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: isDeleted.email,
      subject: `Account Deleted, ${isDeleted.firstName}!`,
      html: renderMail,
    }

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    })

  } catch (error) {
    console.log(error);
    res.status(400).send({
      message: "user failed to delete",
    });
  }
};

const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers["authorization"].split(" ")[1]
      ? req.headers["authorization"].split(" ")[1]
      : req.headers["authorization"].split(" ")[0];

    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
      if (err) {
        res.status(401).send({
          message: "user unauthorized",
        });
        return;
      }

      console.log(decoded);
      req.user = decoded;
      next();
    });
  } catch (error) {
    res.status(401).send({
      message: "user unauthorized",
    });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.roles !== role) {
      res.status(403).send({
        message: "Forbidden: you do not have permission to access this",
      });
      return;
    }
    next();
  };
};

const getMe = async (req, res) => {
  console.log(req.user.id);

  try {
    const user = await UserModel.findById(req.user.id).select("-password");

    res.status(200).send({
      message: "user retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.log(error);
    res.status(404).send({
      message: "user not found",
    });
  }
};

const requestOTP = async (req, res) => {
  console.log("BODY:", req.body);

  const { email } = req.body;

  try {
    const isUser = await UserModel.findOne({ email });
    console.log("USER:", isUser);

    if (!isUser) {
      return res.status(404).send({
        message: "Account not found"
      });
    }

    const sendOTP = otpgen.generate(4, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
      digits: true
    });

    console.log("OTP:", sendOTP);

    await OTPModel.create({ email, otp: sendOTP });

    console.log("OTP saved");

    const otpMailContent = await mailSender('otpMail.ejs', {
      otp: sendOTP,
      firstName: isUser.firstName
    });

    console.log("Mail content ready");

    let mailOptions = {
      from: `"Nana's Pourfection Hub" <${process.env.NODE_MAIL}>`,
      to: email,
      subject: `OTP CODE`,
      html: otpMailContent
    };

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log("MAIL ERROR:", error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    res.status(200).send({
      message: "Otp sent successfully",
    });

  } catch (error) {
    console.log("OTP ERROR:", error);
    res.status(400).send({
      message: "Otp request failed",
      error: error.message
    });
  }
};

const forgotPassword = async (req, res) => {
  const { otp, email, newPassword } = req.body

  try {
    const isUser = await OTPModel.findOne({ email })

    if (!isUser) {
      res.status(404).send({ message: "Invalid OTP" })
      return
    }

    let isMatch = (otp == isUser.otp)

    if (!isMatch) {
      res.status(404).send({ message: "Invalid OTP" })
      return
    }

    const saltround = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, saltround)

    await UserModel.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    )

    res.status(200).send({ message: "Password reset successfully" })

  } catch (error) {
    console.log(error)
    res.status(400).send({ message: "Password reset failed" })
  }
}

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body

  try {
    const isUser = await UserModel.findById(req.user.id)

    if (!isUser) {
      res.status(400).send({
        message: 'invalid user'
      });
      return
    }

    const isMatch = await bcrypt.compare(oldPassword, isUser.password)
    if (!isMatch) {
      res.status(400).send({
        message: 'wrong password'
      });
      return
    }

    const saltround = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, saltround);

    await UserModel.findByIdAndUpdate(req.user.id, { password: hashedPassword });

    res.status(200).send({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.log(error)
    res.status(400).send({ 
      message: 'Password change failed'
    })
  }
}

module.exports = {
  createUser,
  editUser,
  getAllUser,
  deleteUser,
  login,
  verifyUser,
  requireRole,
  getMe,
  requestOTP,
  forgotPassword,
  logout,
  changePassword,
};