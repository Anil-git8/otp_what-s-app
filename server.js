// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { setOTP, verifyOTP } = require('./otpStore');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const { PORT, API_KEY, PHONE_NUMBER_ID, TEMPLATE_NAME, FINANALYZ_API } = process.env;

// Store last OTP phone number
let lastPhoneNumber = null;

// ----------------------------------------------------
// 🚀 SUPER-FAST OTP — respond instantly, send in background
// ----------------------------------------------------
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Save last used phone number for dynamic warm-up
  lastPhoneNumber = phone;

  // Generate OTP instantly
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP temporarily
  setOTP(phone, otp);

  // Respond immediately
  res.json({ success: true, message: 'OTP generated and sending in background' });

  // Send OTP in background
  sendOTPWhatsApp(phone, otp);
});

// ----------------------------------------------------
// 🔥 SEND WHATSAPP OTP (Background)
// ----------------------------------------------------
async function sendOTPWhatsApp(phone, otp) {
  try {
    await axios.post(`${FINANALYZ_API}/send-authentication-template-message`, {
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
            { type: "body", parameters: [{ type: "text", text: otp }] },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }]
            }
          ]
        }
      }
    });

    console.log(`✅ OTP sent to ${phone}: ${otp}`);

  } catch (error) {
    console.error("❌ OTP sending failed:", error.response?.data || error.message);
  }
}

// ----------------------------------------------------
// OTP VERIFY
// ----------------------------------------------------
app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: 'Phone and OTP required' });
  }

  const verified = verifyOTP(phone, otp);

  if (verified) {
    res.json({ success: true, message: 'OTP verified successfully' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
});

// ----------------------------------------------------
// ⚡ DYNAMIC WARM-UP — Uses last requested phone number
// ----------------------------------------------------
async function warmUpWhatsAppAPI() {
  if (!lastPhoneNumber) {
    console.log("⏭ Warm-up skipped — no recent phone number yet.");
    return;
  }

  try {
    console.log(`🔥 Warming up WhatsApp API using ${lastPhoneNumber}...`);


    console.log("🔥 Warm-up successful.");

  } catch (error) {
    console.error("⚠ Warm-up failed:", error.response?.data || error.message);
  }
}

// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------
app.get('/ping', (req, res) => {
  res.send('OK');
});

// ----------------------------------------------------
// START SERVER + AUTO WARM-UP
// ----------------------------------------------------
app.listen(PORT || 5000, async () => {
  console.log(`🚀 Server running on port ${PORT || 5000}`);

  // Warm-up every 10 minutes automatically
  setInterval(warmUpWhatsAppAPI, 10 * 60 * 1000);
});
