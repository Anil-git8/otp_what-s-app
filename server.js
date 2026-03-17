// server.js - MERGED: OTP + Razorpay
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const Razorpay = require("razorpay");
const https = require("https");
const { setOTP, verifyOTP } = require("./otpStore");

const app = express();

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
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "10kb" }));

// ==========================================
// ENV VARS
// ==========================================
const {
  PORT = 3000,
  API_KEY,
  PHONE_NUMBER_ID,
  TEMPLATE_NAME,
  FINANALYZ_API = "https://kycapi.finanalyz.com/api",
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  SELF_URL = "https://otp-what-s-app.onrender.com",
} = process.env;

// ==========================================
// 💳 RAZORPAY SETUP
// ==========================================
const razorpay = new Razorpay({
  key_id: 'rzp_live_RW6EGUwOH81Aul',
  key_secret: 'VuI5bdfHGZEN0Cf1v3R0A1q3',
});

// Pre-warm Razorpay connection
razorpay.orders.all({ count: 1 }).catch(() => {});

// ==========================================
// 🔄 KEEP-ALIVE PINGS (only active in production)
// ==========================================
if (process.env.NODE_ENV === "production") {
  const PING_INTERVAL = 150000;

  function ping() {
    const req = https.get(`${SELF_URL}/health`, { timeout: 3000 }, (res) => {
      res.resume();
    });
    req.on("error", () => {});
    req.on("timeout", () => req.destroy());
  }

  setInterval(ping, PING_INTERVAL);
  setInterval(ping, PING_INTERVAL + 10000);
  setTimeout(ping, 1000);
}

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
// 🚀 GENERAL ROUTES
// ==========================================
app.get("/", (req, res) => {
  res.json({
    message: "WhatsApp OTP + Razorpay API Server",
    version: "2.0.0",
    endpoints: ["/send-otp", "/verify-otp", "/create-order", "/health", "/warmup"],
  });
});

app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || "development",
  });
});

app.get("/warmup", (req, res) => res.json({ ready: true }));

// ==========================================
// 📱 SEND OTP
// ==========================================
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number required" });
  }

  if (!/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  setOTP(phone, otp);

  // Respond immediately, send WhatsApp in background
  res.json({ success: true, message: "OTP sent", expiresIn: 300 });

  sendOTPWhatsApp(phone, otp).catch((err) =>
    console.error("Background send failed:", err.message)
  );
});

// ==========================================
// ✅ VERIFY OTP
// ==========================================
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: "Phone and OTP required" });
  }

  const verified = verifyOTP(phone, otp);

  res.json({
    success: verified,
    message: verified ? "OTP verified successfully" : "Invalid or expired OTP",
  });
});

// ==========================================
// 💳 CREATE RAZORPAY ORDER
// ==========================================
app.post("/create-order", async (req, res) => {
  const start = Date.now();

  try {
    const { amount, currency = "INR" } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: currency.toUpperCase(),
      receipt: `r${Date.now()}`,
    });

    console.log(`✅ Order created: ${Date.now() - start}ms`);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
    });
  } catch (err) {
    console.error(`❌ Order failed: ${Date.now() - start}ms - ${err.message}`);
    res.status(500).json({ success: false, error: "Payment failed" });
  }
});

// ==========================================
// 📤 WHATSAPP SEND FUNCTION
// ==========================================
async function sendOTPWhatsApp(phone, otp) {
  try {
    await whatsappAPI.post(`${FINANALYZ_API}/send-authentication-template-message`, {
      apikey: API_KEY,
      phone_number_id: PHONE_NUMBER_ID,
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
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
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }],
            },
          ],
        },
      },
    });

    console.log(`✅ OTP sent to ${phone}`);
  } catch (error) {
    console.error("❌ WhatsApp API failed:", error.response?.data || error.message);
  }
}

// ==========================================
// 🚀 START SERVER
// ==========================================
global.startTime = Date.now();

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints: /send-otp | /verify-otp | /create-order | /health`);
  console.log(`⚡ Ready in ${Date.now() - global.startTime}ms`);
});

server.timeout = 8000;
server.keepAliveTimeout = 30000;

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => process.exit(0));
});