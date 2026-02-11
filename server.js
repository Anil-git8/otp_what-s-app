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

const { PORT = 3000, API_KEY = '9aa0c52b-ff1a-11ef-8cb4-02c8a5e042bd', PHONE_NUMBER_ID = "598435813347675", TEMPLATE_NAME = 'authenticate_api', FINANALYZ_API = 'https://kycapi.finanalyz.com/api' } = process.env;

// Store last OTP phone number
let lastPhoneNumber = null;

// Axios instance with optimized settings
const whatsappAPI = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// ----------------------------------------------------
// 🚀 SUPER-FAST OTP — respond instantly, send in background
// ----------------------------------------------------
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Validate phone format (basic check)
  if (!/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  // Save last used phone number for dynamic warm-up
  lastPhoneNumber = phone;

  // Generate OTP instantly
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP temporarily
  setOTP(phone, otp);

  // Respond immediately (sub-second response)
  res.json({ 
    success: true, 
    message: 'OTP sent',
    expiresIn: 300 // 5 minutes
  });

  // Send OTP in background (non-blocking)
  sendOTPWhatsApp(phone, otp).catch(err => 
  console.error("Background send failed:", err)
);
});

// ----------------------------------------------------
// 🔥 SEND WHATSAPP OTP (Background)
// ----------------------------------------------------
async function sendOTPWhatsApp(phone, otp) {
  try {
    const response = await whatsappAPI.post(
      `${FINANALYZ_API}/send-authentication-template-message`,
      {
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
                parameters: [{ type: "text", text: otp }] 
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: otp }]
              }
            ]
          }
        }
      }
    );

    console.log(`✅ OTP sent to ${phone}: ${otp} at ${new Date().toLocaleTimeString()}`);

  } catch (error) {
    console.error("❌ OTP sending failed:", error.response?.data || error.message);
    // Optional: Implement retry logic here if needed
  }
}

// ----------------------------------------------------
// ⚡ OTP VERIFY (Optimized)
// ----------------------------------------------------
app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ 
      success: false, 
      message: 'Phone and OTP required' 
    });
  }

  const verified = verifyOTP(phone, otp);

  if (verified) {
    res.json({ 
      success: true, 
      message: 'OTP verified successfully' 
    });
  } else {
    res.status(400).json({ 
      success: false, 
      message: 'Invalid or expired OTP' 
    });
  }
});

// ----------------------------------------------------
// ⚡ LIGHTWEIGHT WARM-UP (No actual OTP send)
// ----------------------------------------------------
async function warmUpWhatsAppAPI() {
  try {
    console.log(`🔥 Warming up at ${new Date().toLocaleTimeString()}...`);
    
    // Just ping the WhatsApp API endpoint to keep connection alive
    await whatsappAPI.head(FINANALYZ_API, {
      timeout: 5000
    }).catch(() => {
      // Silently fail - warmup is best-effort
    });

    console.log("✅ Warm-up complete");

  } catch (error) {
    console.error("⚠ Warm-up failed (non-critical)");
  }
}

// ----------------------------------------------------
// 🏥 HEALTH CHECK (Optimized)
// ----------------------------------------------------
// app.get('/health', (req, res) => {
//   res.status(200).json({ 
//     status: 'OK', 
//     timestamp: Date.now(),
//     uptime: process.uptime()
//   });
// });

// // Legacy endpoint
// app.get('/ping', (req, res) => {
//   res.send('OK');
// });

// ----------------------------------------------------
// 🔄 KEEP SERVER ALIVE (Render Free Tier)
// ----------------------------------------------------
// const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';

// async function keepAlive() {
//   try {
//     await axios.get(`${SELF_URL}/health`, { timeout: 10000 });
//     console.log(`✅ Keep-alive ping: ${new Date().toLocaleTimeString()}`);
//   } catch (err) {
//     console.error(`❌ Keep-alive failed: ${err.message}`);
//   }
// }

// ----------------------------------------------------
// 🚀 START SERVER + AUTO WARM-UP
// ----------------------------------------------------
const server = app.listen(PORT || 5000, async () => {
  console.log(`🚀 Server running on port ${PORT || 5000}`);
  // console.log(`🔗 Health check: ${SELF_URL}/health`);

  // // Initial warm-up after 10 seconds
  // setTimeout(warmUpWhatsAppAPI, 10000);

  // // Warm-up WhatsApp API every 10 minutes
  // setInterval(warmUpWhatsAppAPI, 10 * 60 * 1000);

  // // Keep Render server alive - ping every 14 minutes
  // setInterval(keepAlive, 14 * 60 * 1000);
  
  // // Initial keep-alive ping
  // setTimeout(keepAlive, 15000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});