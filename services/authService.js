// ============================================================
// services/authService.js
// Handles all authentication logic:
//   - Register new user (with role selection: athlete | parent | coach | academy_owner)
//   - Login with JWT token (+ role-based dashboard redirect path)
//   - Email OTP verification
//   - Phone OTP verification
//   - Forgot password / reset via OTP
//   - Token refresh
//   - Logout
//   - Update preferences (location, radius, sport interests)
//   - Update consent flags (analytics, marketing, whatsapp)
//   - Update theme preference
//   - Social login (Google only)
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
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { sendOtpEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Small helper to throw errors that carry an HTTP status + error code,
// so controllers can map them to a response without re-deriving the reason.
const authError = (code, message, statusCode = 401) => {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

// Maps a user's role to the frontend route their dashboard lives at.
// Centralized here so the frontend doesn't need its own role -> route
// switch-case; it just does router.push(user.redirectPath) after login.
const DASHBOARD_ROUTE_BY_ROLE = {
  athlete:       '/dashboard/athlete',
  parent:        '/dashboard/parent',
  coach:         '/dashboard/coach',
  academy_owner: '/dashboard/academy',
  admin:         '/dashboard/admin',
};

const getDashboardRoute = (role) => DASHBOARD_ROUTE_BY_ROLE[role] || '/dashboard';

// ─── 1. REGISTER ─────────────────────────────────────────────
// Creates a new user account.
// role must be one of: 'athlete' | 'parent' | 'coach' | 'academy_owner' | 'admin'
// Frontend onboarding uses 'athlete' and 'parent' (mapped from OnboardingRole).
// Coach/academy signup screens should pass role explicitly.
// isVerified stays false until OTP confirmed.
const registerUser = async ({ name, email, phone, password, role = 'athlete' }) => {
  const validRoles = ['athlete', 'parent', 'coach', 'academy_owner', 'admin'];
  if (!validRoles.includes(role)) throw new Error('Invalid role');

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

  // Send OTP via email
  const emailResult = await sendOtpEmail({ name, email }, otp, 'email_verification');
  if (!emailResult.sent) {
    logger.error('Registration OTP email failed', { userId: user._id, reason: emailResult.reason });
  }

  return { message: 'Registered. Please verify your email.', userId: user._id };
};

// ─── 2. LOGIN ────────────────────────────────────────────────
// Validates credentials and returns access + refresh JWT tokens.
// Returns full user object including role, onboardingCompleted, preferences,
// consent, themePreference, and redirectPath (role-based dashboard route).
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
      redirectPath:        getDashboardRoute(user.role),
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

  // Send OTP via email
  const emailResult = await sendOtpEmail({ name: user.name, email: user.email }, otp, 'password_reset');
  if (!emailResult.sent) {
    logger.error('Password reset OTP email failed', { userId: user._id, reason: emailResult.reason });
  }

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

  // Send OTP via email (phone OTP delivered via email until SMS gateway is integrated)
  const user = await User.findById(userId);
  if (user) {
    const emailResult = await sendOtpEmail({ name: user.name, email: user.email }, otp, 'phone_verification');
    if (!emailResult.sent) {
      logger.error('Phone verification OTP email failed', { userId, reason: emailResult.reason });
    }
  }

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
  return { message: 'Onboarding completed', role: user.role, redirectPath: getDashboardRoute(user.role) };
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

// ─── 12. SOCIAL LOGIN — GOOGLE ───────────────────────────────
// Verifies a Google ID token using google-auth-library, which checks
// the token's signature, expiry, AND that it was issued for *your*
// GOOGLE_CLIENT_ID (the old tokeninfo-endpoint approach didn't check
// audience, so it accepted tokens meant for other apps too).
const verifyGoogleIdToken = async (idToken) => {
  if (!idToken) throw authError('VALIDATION_ERROR', 'Google ID token is required', 400);

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    throw authError('AUTH_ERROR', 'Invalid Google token', 401);
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) {
    throw authError('AUTH_ERROR', 'Google account email not verified', 401);
  }

  const email = payload.email.toLowerCase();
  return {
    email,
    name: payload.name || email.split('@')[0],
    picture: payload.picture || null,
  };
};

// ─── 13. FIND OR CREATE SOCIAL USER ──────────────────────────
// Used by Google login. OAuth users never use their password to
// sign in, so we set a random one and mark the account verified
// (the provider already verified the email for us).
// `role` is passed in by the controller based on which signup flow
// (athlete/parent/coach/academy) triggered the Google button —
// it must NOT be hardcoded, or coach/academy Google sign-ups would
// silently become athletes and land on the wrong dashboard.
const findOrCreateSocialUser = async ({ email, name, provider, role = 'athlete' }) => {
  let user = await User.findOne({ email });

  if (user) {
    if (!user.name && name) user.name = name;
    user.isVerified = true;
    user.authProvider = provider;
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    const validRoles = ['athlete', 'parent', 'coach', 'academy_owner', 'admin'];
    user = await User.create({
      name,
      email,
      password: crypto.randomBytes(32).toString('hex'), // random, never used to log in
      role: validRoles.includes(role) ? role : 'athlete',
      isVerified: true,
      onboardingCompleted: false,
      authProvider: provider,
      lastLoginAt: new Date(),
    });
  }

  return user;
};

// ─── 14. GOOGLE LOGIN ────────────────────────────────────────
// Verifies the Google ID token and returns the matched/created user
// plus a role-based dashboard redirect path, same as normal login.
// Controller passes `role` when this is a coach/academy signup flow.
// Token issuing, refresh-token storage, and cookies stay in the
// controller since those are HTTP-layer concerns.
const googleLogin = async (idToken, role = 'athlete') => {
  const { email, name } = await verifyGoogleIdToken(idToken);
  const user = await findOrCreateSocialUser({ email, name, provider: 'google', role });

  return {
    user,
    redirectPath: getDashboardRoute(user.role),
  };
};

// ─── 15. LOGOUT ──────────────────────────────────────────────
// Stateless JWT — client discards tokens.
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
  googleLogin,
  logout,
  getDashboardRoute,
};
