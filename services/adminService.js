// ============================================================
// services/adminService.js
// Admin-only operations:
//   - Verify academies/coaches (direct toggle)
//   - Manage users (role, active, ban)
//   - Dashboard stats
//   - Review moderation queue
// ============================================================

const Academy = require('../models/Academy');
const Coach   = require('../models/Coach');
const User    = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Review  = require('../models/Review');
const Shortlist = require('../models/Shortlist');
const Lead    = require('../models/Lead');

// ─── VERIFY ACADEMY / COACH ──────────────────────────────────
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
const manageUser = async (userId, updates) => {
  const user = await User.findByIdAndUpdate(userId, updates, { new: true });
  if (!user) throw new Error('User not found');
  return user;
};

// ─── GET ALL USERS (Admin) ────────────────────────────────────
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
const dashboardStats = async () => {
  const [
    totalUsers,
    totalAcademies, totalCoaches,
    totalEnquiries,
    totalReviews, pendingReviews,
    totalShortlists,
    leadsNew, leadsContacted, leadsConverted, leadsLost,
  ] = await Promise.all([
    User.countDocuments(),
    Academy.countDocuments(),
    Coach.countDocuments(),
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
  verifyAcademy,
  verifyCoach,
  manageUser,
  getAllUsers,
  dashboardStats,
};
