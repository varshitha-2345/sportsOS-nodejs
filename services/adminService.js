// ============================================================
// services/adminService.js
// Admin-only operations:
//   - Verify academies/coaches via VerificationCase workflow
//   - Manage users (role, active, ban)
//   - Dashboard stats
//   - Review moderation queue
//
// Frontend alignment:
//   - app/(admin)/admin/* pages
//   - types/domain/verification.ts: VerificationCase
//     status: 'queued' | 'under_review' | 'needs_info' | 'verified' | 'rejected'
//   - types/domain/lead.ts: Lead pipeline stats
//   - Admin dashboardStats now includes leads breakdown
// ============================================================

const Academy          = require('../models/Academy');
const Coach            = require('../models/Coach');
const User             = require('../models/User');
const Enquiry          = require('../models/Enquiry');
const Review           = require('../models/Review');
const Shortlist        = require('../models/Shortlist');
const Lead             = require('../models/Lead');
const VerificationCase = require('../models/VerificationCase');

const VALID_VERIFICATION_STATUSES = ['queued', 'under_review', 'needs_info', 'verified', 'rejected'];

// ─── CREATE VERIFICATION CASE ────────────────────────────────
// Admin or system queues an academy/coach for verification review.
// Matches types/domain/verification.ts VerificationCase
const createVerificationCase = async ({ targetType, targetId, evidence = [] }) => {
  // Check for existing open case
  const existing = await VerificationCase.findOne({
    targetType,
    targetId,
    status: { $nin: ['verified', 'rejected'] }, // open cases
  });
  if (existing) throw new Error('A verification case is already open for this target');

  return VerificationCase.create({
    targetType,
    targetId,
    status:      'queued',
    submittedAt: new Date(),
    evidence,
  });
};

// ─── GET VERIFICATION CASES (Admin) ──────────────────────────
// Returns all verification cases, optionally filtered by status.
// Matches app/(admin)/admin/verification/page.tsx
const getVerificationCases = async ({ status, targetType, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status)     filter.status     = status;
  if (targetType) filter.targetType = targetType;

  const skip = (page - 1) * limit;
  const [cases, total] = await Promise.all([
    VerificationCase.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit),
    VerificationCase.countDocuments(filter),
  ]);

  return { cases, total, page, pages: Math.ceil(total / limit) };
};

// ─── UPDATE VERIFICATION CASE ────────────────────────────────
// Admin moves a verification case through the workflow.
// On 'verified' or 'rejected' — also updates isVerified on Academy/Coach.
const updateVerificationCase = async (caseId, { status, reviewerNotes, decisionReason, assignedTo, moderatorId }) => {
  if (!VALID_VERIFICATION_STATUSES.includes(status)) throw new Error('Invalid verification status');

  const updates = { status };
  if (reviewerNotes)   updates.reviewerNotes  = reviewerNotes;
  if (decisionReason)  updates.decisionReason = decisionReason;
  if (assignedTo)      updates.assignedTo     = assignedTo;
  if (status === 'verified' || status === 'rejected') {
    updates.decidedAt = new Date();
  }

  const vCase = await VerificationCase.findByIdAndUpdate(caseId, updates, { new: true });
  if (!vCase) throw new Error('Verification case not found');

  // Sync isVerified on the actual Academy/Coach document
  if (status === 'verified') {
    if (vCase.targetType === 'academy') {
      await Academy.findByIdAndUpdate(vCase.targetId, { isVerified: true, verificationStatus: 'verified' });
    } else if (vCase.targetType === 'coach') {
      await Coach.findByIdAndUpdate(vCase.targetId, { isVerified: true, verificationStatus: 'verified' });
    }
  } else if (status === 'rejected') {
    if (vCase.targetType === 'academy') {
      await Academy.findByIdAndUpdate(vCase.targetId, { isVerified: false, verificationStatus: 'rejected' });
    } else if (vCase.targetType === 'coach') {
      await Coach.findByIdAndUpdate(vCase.targetId, { isVerified: false, verificationStatus: 'rejected' });
    }
  }

  return vCase;
};

// ─── LEGACY: VERIFY ACADEMY / COACH ──────────────────────────
// Direct toggle for backward compatibility (used when no VerificationCase needed).
const verifyAcademy = async (academyId, status = true) => {
  const academy = await Academy.findByIdAndUpdate(
    academyId,
    { isVerified: status },
    { new: true }
  );
  if (!academy) throw new Error('Academy not found');
  return academy;
};

const verifyCoach = async (coachId, status = true) => {
  const coach = await Coach.findByIdAndUpdate(coachId, { isVerified: status }, { new: true });
  if (!coach) throw new Error('Coach not found');
  return coach;
};

// ─── MANAGE USER ─────────────────────────────────────────────
// Admin changes a user's role, activates/deactivates, or bans them.
// Updates: { isActive, role, isBanned, adminRole }
const manageUser = async (userId, updates) => {
  const user = await User.findByIdAndUpdate(userId, updates, { new: true });
  if (!user) throw new Error('User not found');
  return user;
};

// ─── GET ALL USERS (Admin) ────────────────────────────────────
// Paginated user list for app/(admin)/admin/users/page.tsx
const getAllUsers = async ({ role, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (role) filter.role = role;

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter, '-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, total, page, pages: Math.ceil(total / limit) };
};

// ─── DASHBOARD STATS ─────────────────────────────────────────
// Returns platform summary for the admin dashboard.
// Matches app/(admin)/admin/page.tsx
// Now includes: lead pipeline breakdown, pending verifications, review moderation queue
const dashboardStats = async () => {
  const [
    totalUsers,
    totalAcademies, totalCoaches,
    pendingVerifications,                      // verification cases in queued/under_review
    totalEnquiries,
    totalReviews, pendingReviews,              // reviews awaiting moderation
    totalShortlists,
    // Lead pipeline counts
    leadsNew, leadsContacted, leadsConverted, leadsLost,
  ] = await Promise.all([
    User.countDocuments(),
    Academy.countDocuments(),
    Coach.countDocuments(),
    VerificationCase.countDocuments({ status: { $in: ['queued', 'under_review', 'needs_info'] } }),
    Enquiry.countDocuments(),
    Review.countDocuments(),
    Review.countDocuments({ moderationStatus: 'pending' }),
    Shortlist.countDocuments(),
    Lead.countDocuments({ status: 'new' }),
    Lead.countDocuments({ status: 'contacted' }),
    Lead.countDocuments({ status: 'converted' }),
    Lead.countDocuments({ status: 'lost' }),
  ]);

  return {
    users:      { total: totalUsers },
    academies:  { total: totalAcademies },
    coaches:    { total: totalCoaches },
    verification: { pending: pendingVerifications },
    enquiries:  { total: totalEnquiries },
    reviews:    { total: totalReviews, pendingModeration: pendingReviews },
    shortlists: { total: totalShortlists },
    leads: {
      new:       leadsNew,
      contacted: leadsContacted,
      converted: leadsConverted,
      lost:      leadsLost,
    },
  };
};

module.exports = {
  createVerificationCase,
  getVerificationCases,
  updateVerificationCase,
  verifyAcademy,
  verifyCoach,
  manageUser,
  getAllUsers,
  dashboardStats,
};
