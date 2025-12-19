require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const {
  API_KEY,
  PHONE_NUMBER_ID,
  TEMPLATE_NAME,
  FINANALYZ_API
} = process.env;

/* ================= OTP STORE (IN-MEMORY) ================= */

const otpStore = new Map();

// Save OTP
function setOTP(phone, otp) {
  otpStore.set(phone, {
    otp: otp.toString(),
    timestamp: Date.now()
  });
  console.log(`🟢 Stored OTP for ${phone}: ${otp}`);
}

// Verify OTP
function verifyOTP(phone, enteredOtp) {
  const record = otpStore.get(phone);

  if (!record) {
    console.log(`🔴 No OTP found for ${phone}`);
    return false;
  }

  // Expire after 5 minutes
  if (Date.now() - record.timestamp > 5 * 60 * 1000) {
    otpStore.delete(phone);
    console.log(`⚠️ OTP expired for ${phone}`);
    return false;
  }

  const match = record.otp === enteredOtp.toString();
  if (match) {
    otpStore.delete(phone);
    console.log(`✅ OTP verified for ${phone}`);
  } else {
    console.log(`❌ OTP mismatch for ${phone}`);
  }

  return match;
}

/* ================= ROUTES ================= */

// SEND OTP
app.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number required'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    setOTP(phone, otp);

    // Send OTP synchronously (NO background work)
    try {
      await axios.post(
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
                }
              ]
            }
          }
        }
      );
    } catch (err) {
      console.error('❌ WhatsApp API error:', err.response?.data || err.message);
      return res.status(502).json({
        success: false,
        message: 'Failed to send OTP'
      });
    }

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('❌ /send-otp error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// VERIFY OTP
app.post('/verify-otp', (req, res) => {
  try {
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
      message: verified
        ? 'OTP verified successfully'
        : 'Invalid or expired OTP'
    });

  } catch (error) {
    console.error('❌ /verify-otp error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// HEALTH CHECK
app.get('/ping', (req, res) => {
  res.send('OK');
});

module.exports = app;
