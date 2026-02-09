// otpStore.js - In-memory OTP storage with auto-cleanup
const otpStore = new Map();
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

function setOTP(phone, otp) {
  const expiresAt = Date.now() + OTP_EXPIRY;
  
  otpStore.set(phone, { otp, expiresAt });
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    otpStore.delete(phone);
  }, OTP_EXPIRY);
}

function verifyOTP(phone, otp) {
  const record = otpStore.get(phone);
  
  if (!record) {
    return false;
  }
  
  // Check expiry
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  
  // Verify OTP
  if (record.otp === otp) {
    otpStore.delete(phone); // Remove after successful verification
    return true;
  }
  
  return false;
}

// Cleanup expired OTPs every minute
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(phone);
    }
  }
}, 60 * 1000);

module.exports = { setOTP, verifyOTP };