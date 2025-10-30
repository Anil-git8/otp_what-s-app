require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { setOTP, verifyOTP } = require('./otpStore'); // ✅ import from separate file

const app = express();
app.use(bodyParser.json());
app.use(cors());

const { PORT, API_KEY, PHONE_NUMBER_ID, TEMPLATE_NAME, FINANALYZ_API } = process.env;

// ✅ 1️⃣ Generate and send OTP
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  // Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const response = await axios.post(`${FINANALYZ_API}/send-authentication-template-message`, {
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
    });

    // Save OTP in memory
    setOTP(phone, otp);
    console.log(`✅ OTP sent to ${phone}: ${otp}`);
    res.json({ success: true, message: 'OTP sent successfully' });

  } catch (error) {
    console.error('❌ Error sending OTP:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ✅ 2️⃣ Verify OTP
app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });

  if (verifyOTP(phone, otp)) {
    return res.json({ success: true, message: 'OTP verified successfully' });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
});

app.listen(PORT || 5000, () => console.log(`✅ Server running on port ${PORT || 5000}`));
