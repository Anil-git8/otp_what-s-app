// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { setOTP, verifyOTP } = require('./otpStore');

const app = express();

// ==========================================
// 🔒 CORS CONFIGURATION - CRITICAL FIX
// ==========================================

const allowedOrigins = [
  'https://folkexclusive.com',
  'https://www.folkexclusive.com',
  'http://localhost:4200',
  'http://localhost:3000',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

// This single line handles ALL CORS including preflight
app.use(cors(corsOptions));

// ❌ REMOVE THIS LINE - it causes the error
// app.options('*', cors(corsOptions));

app.use(bodyParser.json());

// ==========================================
// 🚀 HEALTH CHECK (Add this!)
// ==========================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'WhatsApp OTP API Server',
    version: '1.0.0',
    endpoints: ['/send-otp', '/verify-otp', '/health']
  });
});

const { 
  PORT = 3000, 
  API_KEY = '9aa0c52b-ff1a-11ef-8cb4-02c8a5e042bd', 
  PHONE_NUMBER_ID = "598435813347675", 
  TEMPLATE_NAME = 'authenticate_api', 
  FINANALYZ_API = 'https://kycapi.finanalyz.com/api' 
} = process.env;

let lastPhoneNumber = null;

const whatsappAPI = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// ==========================================
// 📱 SEND OTP
// ==========================================
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  if (!/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  lastPhoneNumber = phone;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  setOTP(phone, otp);

  // Respond immediately
  res.json({ 
    success: true, 
    message: 'OTP sent',
    expiresIn: 300 
  });

  // Send in background
  sendOTPWhatsApp(phone, otp).catch(err => 
    console.error("Background send failed:", err.message)
  );
});

// ==========================================
// ✅ VERIFY OTP
// ==========================================
app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ 
      success: false, 
      message: 'Phone and OTP required' 
    });
  }

  const verified = verifyOTP(phone, otp);

  res.json({ 
    success: verified, 
    message: verified ? 'OTP verified successfully' : 'Invalid or expired OTP' 
  });
});

// ==========================================
// 📤 WHATSAPP SEND FUNCTION
// ==========================================
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

    console.log(`✅ OTP sent to ${phone}: ${otp}`);

  } catch (error) {
    console.error("❌ WhatsApp API failed:", error.response?.data || error.message);
  }
}

// ==========================================
// 🚀 START SERVER
// ==========================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Allowed origins:`, allowedOrigins);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});                   