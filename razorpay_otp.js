require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const Razorpay = require("razorpay");
const https = require("https");
const { setOTP, verifyOTP } = require("./otpStore");

const app = express();

/* ==========================================
   🔒 CORS
========================================== */
const allowedOrigins = [
  "https://folkexclusive.com",
  "https://www.folkexclusive.com",
  "http://localhost:4200",
];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10kb" }));

/* ==========================================
   🏥 HEALTH
========================================== */
app.get("/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

/* ==========================================
   📱 OTP CONFIG
========================================== */
const {
  PORT = 3000,
  API_KEY = "9aa0c52b-ff1a-11ef-8cb4-02c8a5e042bd",
  PHONE_NUMBER_ID = "598435813347675",
  TEMPLATE_NAME = "authenticate_api",
  FINANALYZ_API = "https://kycapi.finanalyz.com/api",
  RAZORPAY_KEY_ID = "rzp_live_RW6EGUwOH81Aul",
  RAZORPAY_KEY_SECRET = "VuI5bdfHGZEN0Cf1v3R0A1q3",
} = process.env;

const whatsappAPI = axios.create({
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

/* ==========================================
   📱 SEND OTP
========================================== */
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  setOTP(phone, otp);

  res.json({ success: true, message: "OTP sent" });

  // background WhatsApp send
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
              { type: "body", parameters: [{ type: "text", text: otp }] },
            ],
          },
        },
      }
    );

    console.log(`OTP sent → ${phone}`);
  } catch (e) {
    console.error("WhatsApp error:", e.message);
  }
});

/* ==========================================
   ✅ VERIFY OTP
========================================== */
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false });
  }

  const ok = verifyOTP(phone, otp);
  res.json({ success: ok });
});

/* ==========================================
   💳 RAZORPAY
========================================== */
const razorpay = new Razorpay({
  key_id: rzp_live_RW6EGUwOH81Aul,
  key_secret: VuI5bdfHGZEN0Cf1v3R0A1q3,
});

app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR" } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `r${Date.now()}`,
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
    });
  } catch (err) {
    console.error("Razorpay error:", err.message);
    res.status(500).json({ success: false });
  }
});

/* ==========================================
   🔁 KEEP ALIVE (Render free tier)
========================================== */
const SELF_URL = process.env.SELF_URL;

if (SELF_URL) {
  setInterval(() => {
    https.get(`${SELF_URL}/health`).on("error", () => {});
  }, 150000);
}

/* ==========================================
   🚀 START SERVER
========================================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
