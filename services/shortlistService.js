// ============================================================
// services/shortlistService.js
// Manages a user's saved / bookmarked items.
// Users can shortlist academies, coaches, or sports.
// Think of it like a "Wishlist" or "Favourites".
// ============================================================

const Shortlist = require('../models/Shortlist');

// ─── ADD TO SHORTLIST ────────────────────────────────────────
// Each of these 3 functions adds a specific type of item to the user's shortlist.
// Throws if the item is already shortlisted (prevent duplicates).

const addAcademyToShortlist = async (userId, academyId) => {
  // Check if already saved
  const exists = await Shortlist.findOne({ userId, itemId: academyId, itemType: 'academy' });
  if (exists) throw new Error('Already in shortlist');
  return Shortlist.create({ userId, itemId: academyId, itemType: 'academy' });
};

const addCoachToShortlist = async (userId, coachId) => {
  const exists = await Shortlist.findOne({ userId, itemId: coachId, itemType: 'coach' });
  if (exists) throw new Error('Already in shortlist');
  return Shortlist.create({ userId, itemId: coachId, itemType: 'coach' });
};

const addSportToShortlist = async (userId, sportId) => {
  const exists = await Shortlist.findOne({ userId, itemId: sportId, itemType: 'sport' });
  if (exists) throw new Error('Already in shortlist');
  return Shortlist.create({ userId, itemId: sportId, itemType: 'sport' });
};

// ─── REMOVE FROM SHORTLIST ───────────────────────────────────
// Removes a specific item from the user's shortlist (regardless of type).
const removeFromShortlist = async (userId, itemId) => {
  const record = await Shortlist.findOneAndDelete({ userId, itemId });
  if (!record) throw new Error('Not found in shortlist');
  return { message: 'Removed from shortlist' };
};

// ─── GET USER'S FULL SHORTLIST ────────────────────────────────
// Returns all shortlisted entries (raw, without populating details).
const getUserShortlist = async (userId) => {
  return Shortlist.find({ userId }).sort({ createdAt: -1 }); // newest first
};

// ─── GET SHORTLISTED ITEMS WITH FULL DATA ─────────────────────
// These 3 functions fetch shortlist entries AND join them with the full item details.
// .populate({ path: 'itemId', model: 'Academy' }) = joins Shortlist.itemId → Academy collection

const getShortlistedAcademies = async (userId) => {
  return Shortlist.find({ userId, itemType: 'academy' })
    .populate({ path: 'itemId', model: 'Academy' }); // replace itemId ObjectId with full Academy doc
};

const getShortlistedCoaches = async (userId) => {
  return Shortlist.find({ userId, itemType: 'coach' })
    .populate({ path: 'itemId', model: 'Coach' });
};

const getShortlistedSports = async (userId) => {
  return Shortlist.find({ userId, itemType: 'sport' })
    .populate({ path: 'itemId', model: 'Sport' });
};

// ─── CLEAR ENTIRE SHORTLIST ──────────────────────────────────
// Removes ALL shortlisted items for a user at once.
const clearShortlist = async (userId) => {
  await Shortlist.deleteMany({ userId });
  return { message: 'Shortlist cleared' };
};

// ─── GET DECODED SHORTLIST ───────────────────────────────────
// Returns all 3 types (academies, coaches, sports) in one go with full details.
// Used for the "My Shortlist" page that shows everything together.
const getShortlistDecoded = async (userId) => {
  // Fetch all 3 in parallel
  const [academies, coaches, sports] = await Promise.all([
    getShortlistedAcademies(userId),
    getShortlistedCoaches(userId),
    getShortlistedSports(userId),
  ]);
  return { academies, coaches, sports };
};

module.exports = {
  addAcademyToShortlist,
  addCoachToShortlist,
  addSportToShortlist,
  removeFromShortlist,
  getUserShortlist,
  getShortlistedAcademies,
  getShortlistedCoaches,
  getShortlistedSports,
  clearShortlist,
  getShortlistDecoded,
};
