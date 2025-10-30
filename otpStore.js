// otpStore.js
const otpStore = new Map();

// ✅ Save OTP (store as string)
function setOTP(phone, otp) {
  otpStore.set(phone, { otp: otp.toString(), timestamp: Date.now() });
  console.log(`🟢 Stored OTP for ${phone}: ${otp}`);
}

// ✅ Verify OTP (convert both to string for comparison)
function verifyOTP(phone, enteredOtp) {
  const record = otpStore.get(phone);
  if (!record) {
    console.log(`🔴 No OTP found for ${phone}`);
    return false;
  }

  // Optional: expire OTP after 5 minutes
  const isExpired = Date.now() - record.timestamp > 5 * 60 * 1000;
  if (isExpired) {
    console.log(`⚠️ OTP expired for ${phone}`);
    otpStore.delete(phone);
    return false;
  }

  // ✅ Compare as strings
  const match = record.otp.toString() === enteredOtp.toString();
  if (match) {
    otpStore.delete(phone); // OTP verified once → remove from memory
    console.log(`✅ OTP verified for ${phone}`);
  } else {
    console.log(`❌ OTP mismatch for ${phone}. Expected: ${record.otp}, Got: ${enteredOtp}`);
  }

  return match;
}

module.exports = { setOTP, verifyOTP };
