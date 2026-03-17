// server.js - MERGED: OTP + Razorpay

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const Razorpay = require("razorpay");
const https = require("https");
const { setOTP, verifyOTP } = require("./otpStore");

const app = express();

// ==========================================
// 🔐 HARDCODED CONFIG (NO .env)
// ==========================================
const PORT = 3000;

const API_KEY = "9aa0c52b-ff1a-11ef-8cb4-02c8a5e042bd";
const PHONE_NUMBER_ID = "598435813347675";
const TEMPLATE_NAME = "authenticate_api";
const FINANALYZ_API = "https://kycapi.finanalyz.com/api";

const RAZORPAY_KEY_ID = "rzp_live_RW6EGUwOH81Aul";
const RAZORPAY_KEY_SECRET = "VuI5bdfHGZEN0Cf1v3R0A1q3";

const SELF_URL = "http://54.91.135.1:3000";

// ==========================================
// 🔒 CORS CONFIGURATION
// ==========================================
const allowedOrigins = [
  "https://folkexclusive.com",
  "https://www.folkexclusive.com",
  "http://localhost:4200",
  "http://localhost:3000",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "10kb" }));

// ==========================================
// 💳 RAZORPAY SETUP
// ==========================================
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ==========================================
// 📡 WHATSAPP AXIOS INSTANCE
// ==========================================
const whatsappAPI = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ==========================================
// 🚀 ROUTES
// ==========================================
app.get("/", (req, res) => {
  res.json({
    message: "WhatsApp OTP + Razorpay API Server",
    endpoints: ["/send-otp", "/verify-otp", "/create-order", "/health"],
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    time: new Date().toISOString(),
  });
});

// ==========================================
// 📱 SEND OTP
// ==========================================
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  setOTP(phone, otp);

  res.json({ success: true, message: "OTP sent" });

  sendOTPWhatsApp(phone, otp);
});

// ==========================================
// ✅ VERIFY OTP
// ==========================================
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  const verified = verifyOTP(phone, otp);

  res.json({
    success: verified,
    message: verified ? "OTP verified" : "Invalid OTP",
  });
});

// ==========================================
// 💳 CREATE ORDER
// ==========================================
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `r${Date.now()}`,
    });

    res.json({
      success: true,
      orderId: order.id,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Order failed" });
  }
});

// ==========================================
// 📤 WHATSAPP SEND FUNCTION
// ==========================================
async function sendOTPWhatsApp(phone, otp) {
  try {
    await whatsappAPI.post(
      `${FINANALYZ_API}/send-authentication-template-message`,
      {
        apikey: API_KEY,
        phone_number_id: PHONE_NUMBER_ID,
        body: {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: otp }],
              },
            ],
          },
        },
      }
    );

    console.log(`✅ OTP sent to ${phone}`);
  } catch (error) {
    console.error("❌ WhatsApp API failed:", error.response?.data || error.message);
  }
}

// ==========================================
// 🚀 START SERVER
// ==========================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});