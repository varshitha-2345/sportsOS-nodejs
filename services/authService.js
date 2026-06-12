// ============================================================
// services/authService.js
// Handles all authentication logic:
//   - Register new user (with role selection: athlete | parent)
//   - Login with JWT token
//   - Email OTP verification
//   - Phone OTP verification
//   - Forgot password / reset via OTP
//   - Token refresh
//   - Logout
//   - Update preferences (location, radius, sport interests)
//   - Update consent flags (analytics, marketing, whatsapp)
//   - Update theme preference
//
// Frontend alignment:
//   - OnboardingRole: 'athlete' | 'parent'  (use-auth.ts)
//   - UserProfile: name, email, phone        (use-auth.ts)
//   - User.preferences, consent, themePreference (types/domain/user.ts)
// ============================================================

const User   = require('../models/User');
const Role   = require('../models/Role');
const OTP    = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ─── 1. REGISTER ─────────────────────────────────────────────
// Creates a new user account.
// role must be one of: 'athlete' | 'parent' | 'coach' | 'academy_owner' | 'admin'
// Frontend onboarding uses 'athlete' and 'parent' (mapped from OnboardingRole).
// isVerified stays false until OTP confirmed.
const registerUser = async ({ name, email, phone, password, role = 'athlete' }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error('Email already registered');

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password: hashed,
    role,
    isVerified: false,
    onboardingCompleted: false, // set to true after role selection step
  });

  // Generate 6-digit OTP for email verification
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await OTP.create({ userId: user._id, otp, type: 'email_verification' });

  // TODO: Send OTP to user's email via email service
  return { message: 'Registered. Please verify your email.', userId: user._id };
};

// ─── 2. LOGIN ────────────────────────────────────────────────
// Validates credentials and returns access + refresh JWT tokens.
// Returns full user object including role, onboardingCompleted, preferences, consent, themePreference.
const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');

  if (!user.isVerified) throw new Error('Email not verified');

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    refreshToken,
    user: {
      id:                  user._id,
      name:                user.name,
      email:               user.email,
      phone:               user.phone,
      role:                user.role,
      onboardingCompleted: user.onboardingCompleted,
      verified:            user.isVerified,
      preferences:         user.preferences || {},
      consent:             user.consent     || { analytics: false, marketing: false, whatsapp: false },
      themePreference:     user.themePreference || 'system',
    },
  };
};

// ─── 3. FORGOT PASSWORD ──────────────────────────────────────
// Sends a password-reset OTP to the user's email.
const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Remove any existing password_reset OTP (only one at a time)
  await OTP.findOneAndDelete({ userId: user._id, type: 'password_reset' });

  await OTP.create({
    userId:    user._id,
    otp,
    type:      'password_reset',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  // TODO: Send OTP to user's email
  return { message: 'OTP sent to email' };
};

// ─── 4. RESET PASSWORD ───────────────────────────────────────
// Validates the OTP and sets a new password.
const resetPassword = async ({ userId, otp, newPassword }) => {
  const record = await OTP.findOne({ userId, otp, type: 'password_reset' });
  if (!record) throw new Error('Invalid or expired OTP');

  const hashed = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(userId, { password: hashed });
  await OTP.findByIdAndDelete(record._id);

  return { message: 'Password reset successfully' };
};

// ─── 5. VERIFY EMAIL ─────────────────────────────────────────
// Confirms the OTP entered after registration.
// Matches frontend: app/(auth)/verify/email/page.tsx
const verifyEmail = async ({ userId, otp }) => {
  const record = await OTP.findOne({ userId, otp, type: 'email_verification' });
  if (!record) throw new Error('Invalid or expired OTP');

  await User.findByIdAndUpdate(userId, { isVerified: true });
  await OTP.findByIdAndDelete(record._id);

  return { message: 'Email verified successfully' };
};

// ─── 6. VERIFY PHONE ─────────────────────────────────────────
// Confirms phone OTP — used in app/(auth)/verify/phone/page.tsx
// and app/(auth)/verify/signup/page.tsx
const sendPhoneOtp = async ({ userId, phone }) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await OTP.findOneAndDelete({ userId, type: 'phone_verification' });
  await OTP.create({
    userId,
    otp,
    type:      'phone_verification',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Update the phone number on user record if provided
  if (phone) await User.findByIdAndUpdate(userId, { phone });

  // TODO: Send OTP via SMS / WhatsApp gateway
  return { message: 'OTP sent to phone' };
};

const verifyPhone = async ({ userId, otp }) => {
  const record = await OTP.findOne({ userId, otp, type: 'phone_verification' });
  if (!record) throw new Error('Invalid or expired OTP');

  await User.findByIdAndUpdate(userId, { phoneVerified: true });
  await OTP.findByIdAndDelete(record._id);

  return { message: 'Phone verified successfully' };
};

// ─── 7. COMPLETE ONBOARDING ──────────────────────────────────
// Called after user selects their role in app/(auth)/onboarding/role/page.tsx.
// Sets onboardingCompleted = true and saves the role.
const completeOnboarding = async (userId, role) => {
  const validRoles = ['athlete', 'parent', 'coach', 'academy_owner', 'admin'];
  if (!validRoles.includes(role)) throw new Error('Invalid role');

  const user = await User.findByIdAndUpdate(
    userId,
    { role, onboardingCompleted: true },
    { new: true }
  );
  if (!user) throw new Error('User not found');
  return { message: 'Onboarding completed', role: user.role };
};

// ─── 8. REFRESH TOKEN ────────────────────────────────────────
// Issues a new access token using the refresh token.
const refreshToken = async ({ refreshToken }) => {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user    = await User.findById(decoded.userId);
  if (!user) throw new Error('User not found');

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { token };
};

// ─── 9. UPDATE PREFERENCES ───────────────────────────────────
// User saves location, default radius, sport interests.
// Matches User.preferences in types/domain/user.ts.
const updatePreferences = async (userId, preferences) => {
  // preferences: { location?, defaultRadiusKm?, defaultSportInterests? }
  const user = await User.findByIdAndUpdate(
    userId,
    { preferences },
    { new: true }
  );
  if (!user) throw new Error('User not found');
  return { preferences: user.preferences };
};

// ─── 10. UPDATE CONSENT FLAGS ─────────────────────────────────
// User toggles analytics, marketing, whatsapp consent.
// Matches ConsentFlags in types/domain/user.ts.
const updateConsent = async (userId, consent) => {
  // consent: { analytics: bool, marketing: bool, whatsapp: bool }
  const user = await User.findByIdAndUpdate(
    userId,
    { consent },
    { new: true }
  );
  if (!user) throw new Error('User not found');
  return { consent: user.consent };
};

// ─── 11. UPDATE THEME PREFERENCE ─────────────────────────────
// User picks their preferred theme in app/(private)/settings/theme/page.tsx.
// Valid values: 'midnight-ice' | 'ember-orange' | 'graphite-titanium' | 'alpine-light' | 'system'
const updateTheme = async (userId, themePreference) => {
  const validThemes = ['midnight-ice', 'ember-orange', 'graphite-titanium', 'alpine-light', 'system'];
  if (!validThemes.includes(themePreference)) throw new Error('Invalid theme');

  const user = await User.findByIdAndUpdate(userId, { themePreference }, { new: true });
  if (!user) throw new Error('User not found');
  return { themePreference: user.themePreference };
};

// ─── 12. LOGOUT ──────────────────────────────────────────────
// Stateless JWT — client discards tokens.
// TODO: If refresh tokens stored in DB, delete them here.
const logout = async ({ userId }) => {
  return { message: 'Logged out successfully' };
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendPhoneOtp,
  verifyPhone,
  completeOnboarding,
  refreshToken,
  updatePreferences,
  updateConsent,
  updateTheme,
  logout,
};
