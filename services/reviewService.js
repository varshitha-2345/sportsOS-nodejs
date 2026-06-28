// ============================================================
// services/reviewService.js
// Handles user reviews and star ratings for academies and coaches.
//
// Frontend alignment (types/domain/review.ts):
//   - Review.moderationStatus: 'pending' | 'approved' | 'rejected'
//   - Review.text (not 'comment' — renamed to match frontend type)
//   - Review.moderatorId: set when admin approves/rejects
//
// After every review add/update, average rating is recalculated.
// Only 'approved' reviews count toward the avgRating.
// ============================================================

const Review  = require('../models/Review');
const Academy = require('../models/Academy');
const Coach   = require('../models/Coach');

const VALID_MODERATION = ['pending', 'approved', 'rejected'];

// ─── ADD REVIEW ──────────────────────────────────────────────
// User submits a star rating + text for an academy or coach.
// Review starts in 'pending' moderation state — not visible publicly until approved.
// One user can review the same target only once.
const addReview = async ({ userId, targetId, targetType, rating, text }) => {
  const existing = await Review.findOne({ userId, targetId, targetType });
  if (existing) throw new Error('You have already reviewed this');

  const review = await Review.create({
    userId,
    targetId,
    targetType,
    rating,
    text,
    moderationStatus: 'pending', // requires admin approval before shown publicly
  });

  // Don't recalculate avgRating yet — only approved reviews count
  return review;
};

// ─── UPDATE REVIEW ───────────────────────────────────────────
// User edits their review (rating or text).
// Resets moderationStatus to 'pending' so admin re-reviews the edit.
const updateReview = async (reviewId, userId, { rating, text }) => {
  const review = await Review.findOneAndUpdate(
    { _id: reviewId, userId },
    { rating, text, moderationStatus: 'pending' }, // re-enter moderation queue
    { new: true }
  );
  if (!review) throw new Error('Review not found or unauthorized');

  // Recalculate from currently approved reviews only
  await calculateRating(review.targetId, review.targetType);
  return review;
};

// ─── MODERATE REVIEW ─────────────────────────────────────────
// Admin approves or rejects a review.
// Matched to app/(admin)/admin/verification/page.tsx review moderation.
// status: 'approved' | 'rejected'
// moderatorId: the admin user's ID
const moderateReview = async (reviewId, { status, moderatorId }) => {
  if (!VALID_MODERATION.includes(status) || status === 'pending') {
    throw new Error('Invalid moderation status — use approved or rejected');
  }

  const review = await Review.findByIdAndUpdate(
    reviewId,
    { moderationStatus: status, moderatorId },
    { new: true }
  );
  if (!review) throw new Error('Review not found');

  // Recalculate average from approved reviews after status change
  await calculateRating(review.targetId, review.targetType);
  return review;
};

// ─── GET REVIEWS (Public — approved only) ────────────────────
// Returns paginated approved reviews for a given academy or coach.
// Only moderationStatus = 'approved' reviews are shown to the public.
const getApprovedReviews = async (targetId, targetType, { page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit;
  const filter = { targetId, targetType, moderationStatus: 'approved' };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('userId', 'name')  // only reveal name, not email
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Review.countDocuments(filter),
  ]);

  return { reviews, total, page, pages: Math.ceil(total / limit) };
};

// ─── GET ACADEMY REVIEWS (Approved) ──────────────────────────
// Convenience wrapper for academy detail pages.
const getAcademyReviews = async (academyId, options) => {
  return getApprovedReviews(academyId, 'academy', options);
};

// ─── GET PENDING REVIEWS (Admin) ─────────────────────────────
// Admin moderation queue — returns all reviews awaiting approval.
const getPendingReviews = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const filter = { moderationStatus: 'pending' };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('userId', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Review.countDocuments(filter),
  ]);

  return { reviews, total, page, pages: Math.ceil(total / limit) };
};

// ─── CALCULATE AVERAGE RATING ────────────────────────────────
// Aggregates ONLY approved reviews to compute average rating and count.
// Updates avgRating and reviewCount on the academy or coach document.
// Called internally after add/update/moderate.
const calculateRating = async (targetId, targetType) => {
  const result = await Review.aggregate([
    {
      $match: {
        targetId:          require('mongoose').Types.ObjectId.createFromHexString(targetId.toString()),
        targetType,
        moderationStatus: 'approved', // only count approved reviews
      },
    },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg   = result[0]?.avg   || 0;
  const count = result[0]?.count || 0;

  const avgRounded = Math.round(avg * 10) / 10;

  if (targetType === 'academy') {
    await Academy.findByIdAndUpdate(targetId, { 'rating.average': avgRounded, 'rating.count': count });
  } else if (targetType === 'coach') {
    await Coach.findByIdAndUpdate(targetId, { 'rating.average': avgRounded, 'rating.count': count });
  }

  return { avgRating: avgRounded, reviewCount: count };
};

module.exports = {
  addReview,
  updateReview,
  moderateReview,
  getApprovedReviews,
  getAcademyReviews,
  getPendingReviews,
  calculateRating,
};
