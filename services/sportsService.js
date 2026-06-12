// ============================================================
// services/sportsService.js
// CRUD and comparison for the master Sports list.
//
// Frontend alignment (types/domain/sport.ts):
//   - Sport.competitionPathway: { levels: [{ key, label, description }] }
//     levels: 'district' | 'state' | 'national' | 'international'
//   - Sport.explorationGuidance: { ageSuitability?, physicalRequirements?, notes? }
//   - Sport.status: 'published' | 'draft'
//   - Sport.category: 'team' | 'individual' | 'combat' | 'racquet' | 'aquatic' | 'athletics' | 'other'
//   - Sport.icon, Sport.coverImage
//
// Pages using sports:
//   app/(public)/sports/page.tsx        — all sports listing
//   app/(public)/sports/[slug]/page.tsx — sport detail with pathway
// ============================================================

const Sport       = require('../models/Sport');
const slugService = require('./slugService');

// ─── ADD SPORT ───────────────────────────────────────────────
// Admin adds a new sport to the platform master list.
// Auto-generates a URL-friendly slug from the sport name.
const addSport = async (data) => {
  const slug = await slugService.generateSlug(data.name, 'sport');

  return Sport.create({
    ...data,
    slug,
    status: data.status || 'published',
    competitionPathway: data.competitionPathway || { levels: [] },
    explorationGuidance: data.explorationGuidance || null,
  });
};

// ─── UPDATE SPORT ────────────────────────────────────────────
const updateSport = async (sportId, updates) => {
  const sport = await Sport.findByIdAndUpdate(sportId, updates, { new: true });
  if (!sport) throw new Error('Sport not found');
  return sport;
};

// ─── DELETE SPORT ────────────────────────────────────────────
const deleteSport = async (sportId) => {
  const sport = await Sport.findByIdAndDelete(sportId);
  if (!sport) throw new Error('Sport not found');
  return { message: 'Sport deleted' };
};

// ─── GET ALL SPORTS ──────────────────────────────────────────
// Returns the full published sports list sorted A-Z.
// Used in dropdowns/filters across the app.
const getAllSports = async ({ status = 'published', category } = {}) => {
  const filter = {};
  if (status)   filter.status   = status;
  if (category) filter.category = category;
  return Sport.find(filter).sort({ name: 1 });
};

// ─── GET SPORT BY SLUG ────────────────────────────────────────
// For SEO-friendly sport detail pages like /sports/cricket
// Returns the full sport including competitionPathway and explorationGuidance.
const getSportBySlug = async (slug) => {
  const sport = await Sport.findOne({ slug });
  if (!sport) throw new Error('Sport not found');
  return sport;
};

// ─── GET SPORT BY ID ─────────────────────────────────────────
const getSportById = async (sportId) => {
  const sport = await Sport.findById(sportId);
  if (!sport) throw new Error('Sport not found');
  return sport;
};

// ─── COMPARE SPORTS ──────────────────────────────────────────
// Side-by-side comparison of two sports.
// Returns ageRange/difficulty/career from existing data + new pathway/guidance fields.
const compareSports = async (sportId1, sportId2) => {
  const [s1, s2] = await Promise.all([
    Sport.findById(sportId1),
    Sport.findById(sportId2),
  ]);
  if (!s1 || !s2) throw new Error('One or both sports not found');

  // Helper to shape sport data uniformly for comparison
  const format = (s) => ({
    id:                  s._id,
    name:                s.name,
    category:            s.category,
    ageRange:            s.ageRange             || null, // legacy field
    difficulty:          s.difficulty            || null, // legacy field
    careerOpportunities: s.careerOpportunities   || null, // legacy field
    competitionPathway:  s.competitionPathway    || { levels: [] },
    explorationGuidance: s.explorationGuidance   || null,
    description:         s.description,
    icon:                s.icon                  || null,
    coverImage:          s.coverImage            || null,
  });

  return { sport1: format(s1), sport2: format(s2) };
};

module.exports = {
  addSport,
  updateSport,
  deleteSport,
  getAllSports,
  getSportBySlug,
  getSportById,
  compareSports,
};
