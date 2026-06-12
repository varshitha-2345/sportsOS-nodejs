// ============================================================
// services/academyService.js
// All database operations related to Sports Academies:
//   - Create, Update, Delete
//   - Fetch by ID or slug
//   - Search with filters
//   - Featured academies
//   - Rank score calculation
//
// Frontend alignment (types/domain/academy.ts):
//   - Academy.sportsOffered: string[]  (array of sport slugs — renamed from 'sports')
//   - Academy.facilities: Facility[]
//     'indoor' | 'outdoor' | 'ground' | 'court' | 'equipment' |
//     'changing_room' | 'parking' | 'physio' | 'gym'
//   - Academy.trainingLevels: 'beginner' | 'intermediate' | 'advanced' | 'elite'
//   - Academy.verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
//   - Academy.status: 'draft' | 'published' | 'suspended'
//   - Academy.achievementSignals: { stateAthletesProduced, nationalAthletesProduced, ... }
//   - Academy.certifications: [{ name, issuer, year, documentUrl? }]
//   - Academy.batchInformation: string
// ============================================================

const Academy         = require('../models/Academy');
const AcademyImage    = require('../models/AcademyImage');
const AcademyFacility = require('../models/AcademyFacility');
const slugService     = require('./slugService');

// ─── CREATE ACADEMY ──────────────────────────────────────────
// Called when an academy owner registers their academy.
// Auto-generates a unique slug from the academy name.
const createAcademy = async (data) => {
  const slug = await slugService.generateSlug(data.name, 'academy');

  return Academy.create({
    ...data,
    slug,
    verificationStatus: 'unverified', // starts unverified until admin approves
    status:             data.status || 'draft',
    sportsOffered:      data.sportsOffered || data.sports || [], // accept both field names
    achievementSignals: data.achievementSignals || {
      stateAthletesProduced:    0,
      nationalAthletesProduced: 0,
      competitionParticipations: [],
      milestones: [],
    },
    certifications: data.certifications || [],
  });
};

// ─── UPDATE ACADEMY ──────────────────────────────────────────
// Updates academy fields (phone, address, sports, facilities, etc.)
const updateAcademy = async (academyId, updates) => {
  // Normalise sports field name for backward compat
  if (updates.sports && !updates.sportsOffered) {
    updates.sportsOffered = updates.sports;
    delete updates.sports;
  }

  const academy = await Academy.findByIdAndUpdate(academyId, updates, { new: true });
  if (!academy) throw new Error('Academy not found');
  return academy;
};

// ─── DELETE ACADEMY ──────────────────────────────────────────
const deleteAcademy = async (academyId) => {
  const academy = await Academy.findByIdAndDelete(academyId);
  if (!academy) throw new Error('Academy not found');
  return { message: 'Academy deleted' };
};

// ─── GET ACADEMY BY ID ────────────────────────────────────────
// Fetches full academy details including images and facilities.
const getAcademyById = async (academyId) => {
  const academy = await Academy.findById(academyId)
    .populate('images')
    .populate('facilities');
  if (!academy) throw new Error('Academy not found');
  return academy;
};

// ─── GET ACADEMY BY SLUG ──────────────────────────────────────
// Used for SEO-friendly URLs like /academies/sportz-village
// Matches app/(public)/academies/[slug]/page.tsx
const getAcademyBySlug = async (slug) => {
  const academy = await Academy.findOne({ slug })
    .populate('images')
    .populate('facilities');
  if (!academy) throw new Error('Academy not found');
  return academy;
};

// ─── SEARCH ACADEMIES ────────────────────────────────────────
// Filtered + paginated search for the search results page.
// Only shows published + verified academies publicly.
// Supports: keyword, city, sport, trainingLevel, facilities filters.
const searchAcademies = async ({
  query, city, sport, trainingLevel, facility,
  page = 1, limit = 10,
  onlyVerified = true, // public search only shows verified
}) => {
  const filter = {};

  if (onlyVerified) {
    filter.isVerified          = true;
    filter.verificationStatus  = 'verified';
    filter.status              = 'published';
  }

  if (query)         filter.$text          = { $search: query };
  if (city)          filter.city           = new RegExp(city, 'i');
  if (sport)         filter.sportsOffered  = sport;  // updated field name
  if (trainingLevel) filter.trainingLevels = trainingLevel;
  if (facility)      filter.facilities     = facility;

  const skip = (page - 1) * limit;
  const [academies, total] = await Promise.all([
    Academy.find(filter).skip(skip).limit(limit),
    Academy.countDocuments(filter),
  ]);

  return { academies, total, page, pages: Math.ceil(total / limit) };
};

// ─── GET FEATURED ACADEMIES ──────────────────────────────────
// Returns top featured and verified academies for the homepage.
// Matches components/home/featured-academies.tsx
const getFeaturedAcademies = async (limit = 10) => {
  return Academy.find({
    isFeatured:         true,
    isVerified:         true,
    verificationStatus: 'verified',
    status:             'published',
  }).limit(limit);
};

// ─── CALCULATE RANK SCORE ────────────────────────────────────
// Formula: (avgRating × 20) + (reviewCount × 2) + shortlistCount
// Used to sort academies in search results.
const calculateAcademyRank = async (academyId) => {
  const academy = await Academy.findById(academyId);
  if (!academy) throw new Error('Academy not found');

  const score =
    (academy.avgRating     || 0) * 20 +
    (academy.reviewCount   || 0) * 2  +
    (academy.shortlistCount || 0);

  await Academy.findByIdAndUpdate(academyId, { rankScore: score });
  return { rankScore: score };
};

module.exports = {
  createAcademy,
  updateAcademy,
  deleteAcademy,
  getAcademyById,
  getAcademyBySlug,
  searchAcademies,
  getFeaturedAcademies,
  calculateAcademyRank,
};
