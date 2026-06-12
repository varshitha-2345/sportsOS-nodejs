// ============================================================
// services/coachService.js
// All operations related to Coaches:
//   - CRUD (Create, Read, Update, Delete)
//   - Search with filters
//   - Featured coaches
//   - Side-by-side comparison
//   - Rank score calculation
//
// Frontend alignment (types/domain/coach.ts):
//   - Coach.sportsCoached: string[]  (array of sport slugs — renamed from 'sports')
//   - Coach.specialization: string[]  (new — specific coaching specialties)
//   - Coach.experienceYears: number   (renamed from 'experience')
//   - Coach.verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
//   - Coach.status: 'draft' | 'published' | 'suspended'
//   - Coach.academyId?: string  (optional — coach may be independent)
// ============================================================

const Coach            = require('../models/Coach');
const CoachCertificate = require('../models/CoachCertificate');
const slugService      = require('./slugService');

// ─── CREATE COACH ────────────────────────────────────────────
// Registers a new coach profile. Auto-generates a unique slug.
const createCoach = async (data) => {
  const slug = await slugService.generateSlug(data.name, 'coach');

  return Coach.create({
    ...data,
    slug,
    sportsCoached:      data.sportsCoached || data.sports || [], // accept both field names
    experienceYears:    data.experienceYears || data.experience || 0,
    specialization:     data.specialization || [],
    verificationStatus: 'unverified',
    status:             data.status || 'draft',
    certifications:     data.certifications || [],
  });
};

// ─── UPDATE COACH ────────────────────────────────────────────
// Updates coach profile fields (bio, experience, fee, etc.)
const updateCoach = async (coachId, updates) => {
  // Normalise field names for backward compat
  if (updates.sports && !updates.sportsCoached) {
    updates.sportsCoached = updates.sports;
    delete updates.sports;
  }
  if (updates.experience && !updates.experienceYears) {
    updates.experienceYears = updates.experience;
    delete updates.experience;
  }

  const coach = await Coach.findByIdAndUpdate(coachId, updates, { new: true });
  if (!coach) throw new Error('Coach not found');
  return coach;
};

// ─── DELETE COACH ────────────────────────────────────────────
const deleteCoach = async (coachId) => {
  const coach = await Coach.findByIdAndDelete(coachId);
  if (!coach) throw new Error('Coach not found');
  return { message: 'Coach deleted' };
};

// ─── GET COACH BY ID ─────────────────────────────────────────
// Returns full coach profile including certifications and academy.
const getCoachById = async (coachId) => {
  const coach = await Coach.findById(coachId)
    .populate('certificates')
    .populate('academyId');
  if (!coach) throw new Error('Coach not found');
  return coach;
};

// ─── GET COACH BY SLUG ────────────────────────────────────────
// Used for SEO-friendly URLs like /coaches/rahul-sharma
// Matches app/(public)/coaches/[slug]/page.tsx
const getCoachBySlug = async (slug) => {
  const coach = await Coach.findOne({ slug })
    .populate('certificates')
    .populate('academyId');
  if (!coach) throw new Error('Coach not found');
  return coach;
};

// ─── SEARCH COACHES ──────────────────────────────────────────
// Keyword + filters search with pagination. Only verified coaches returned publicly.
const searchCoaches = async ({
  query, sport, city, specialization,
  page = 1, limit = 10,
  onlyVerified = true,
}) => {
  const filter = {};

  if (onlyVerified) {
    filter.isVerified         = true;
    filter.verificationStatus = 'verified';
    filter.status             = 'published';
  }

  if (query)          filter.$text         = { $search: query };
  if (sport)          filter.sportsCoached = sport;      // updated field name
  if (city)           filter.city          = new RegExp(city, 'i');
  if (specialization) filter.specialization = specialization;

  const skip = (page - 1) * limit;
  const [coaches, total] = await Promise.all([
    Coach.find(filter).skip(skip).limit(limit),
    Coach.countDocuments(filter),
  ]);

  return { coaches, total, page, pages: Math.ceil(total / limit) };
};

// ─── GET FEATURED COACHES ────────────────────────────────────
// Returns highlighted coaches for the homepage.
// Matches components/home/featured-coaches.tsx
const getFeaturedCoaches = async (limit = 10) => {
  return Coach.find({
    isFeatured:         true,
    isVerified:         true,
    verificationStatus: 'verified',
    status:             'published',
  }).limit(limit);
};

// ─── GET COACH DETAILS ────────────────────────────────────────
// Full details including certificates, academy, and sports — for the coach detail page.
const getCoachDetails = async (coachId) => {
  return Coach.findById(coachId)
    .populate('certificates')
    .populate('academyId')
    .populate('sportsCoached'); // updated field name
};

// ─── COMPARE COACHES ─────────────────────────────────────────
// Returns side-by-side comparable data for two coaches.
// Used on the Compare feature: compare-view.tsx
const compareCoaches = async (coachId1, coachId2) => {
  const [c1, c2] = await Promise.all([
    Coach.findById(coachId1).populate('certificates'),
    Coach.findById(coachId2).populate('certificates'),
  ]);
  if (!c1 || !c2) throw new Error('One or both coaches not found');

  const format = (c) => ({
    id:              c._id,
    name:            c.name,
    experienceYears: c.experienceYears || c.experience || 0, // both field names
    rating:          c.avgRating,
    certifications:  c.certificates,
    sportsCoached:   c.sportsCoached || c.sports || [],
    specialization:  c.specialization || [],
    city:            c.city,
    verificationStatus: c.verificationStatus,
  });

  return { coach1: format(c1), coach2: format(c2) };
};

// ─── CALCULATE COACH RANK SCORE ───────────────────────────────
// Formula: (avgRating × 20) + (reviewCount × 2) + (experienceYears × 5)
const calculateCoachRank = async (coachId) => {
  const coach = await Coach.findById(coachId);
  if (!coach) throw new Error('Coach not found');

  const score =
    (coach.avgRating      || 0) * 20 +
    (coach.reviewCount    || 0) * 2  +
    ((coach.experienceYears || coach.experience || 0) * 5);

  await Coach.findByIdAndUpdate(coachId, { rankScore: score });
  return { rankScore: score };
};

module.exports = {
  createCoach,
  updateCoach,
  deleteCoach,
  getCoachById,
  getCoachBySlug,
  searchCoaches,
  getFeaturedCoaches,
  getCoachDetails,
  compareCoaches,
  calculateCoachRank,
};
