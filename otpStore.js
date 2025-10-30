// otpStore.js
const otpStore = new Map();

// Save OTP with 5-minute expiration
function setOTP(phone, otp) {
  otpStore.set(phone, { otp, expires: Date.now() + 5 * 60 * 1000 });
}

// Verify OTP
function verifyOTP(phone, otp) {
  const data = otpStore.get(phone);
  if (!data) return false;
  const valid = data.otp === otp && Date.now() < data.expires;
  if (valid) otpStore.delete(phone); // delete after verification
  return valid;
}

module.exports = { setOTP, verifyOTP };
