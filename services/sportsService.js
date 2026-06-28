// ============================================================
// services/sportsService.js
// CRUD and comparison for the master Sports list.
//
// Frontend alignment (types/domain/sport.ts):
//   - Sport.category: 'Indoor' | 'Outdoor' | 'Both'
//   - Sport.sportType: 'team' | 'individual' | 'both'
//   - Sport.competitionPathway: { levels: [{ key, label, description }] }
//   - Sport.explorationGuidance: { ageSuitability?, physicalRequirements?, notes? }
//   - Sport.tournaments: [{ tournamentName, level, organizer, frequency, shortDescription }]
//   - Sport.status: 'published' | 'draft'
//
// Pages using sports:
//   app/(public)/sports/page.tsx        — all sports listing
//   app/(public)/sports/[slug]/page.tsx — sport detail with pathway
// ============================================================

const Sport       = require('../models/Sport');
const slugService = require('./slugService');

const DEFAULT_ICON   = '/images/sports/default-sport.svg';
const DEFAULT_COVER  = '/images/sports/default-sport-cover.jpg';

// ─── ADD SPORT ───────────────────────────────────────────────
// Admin adds a new sport to the platform master list.
// Auto-generates a URL-friendly slug from the sport name.
const addSport = async (data) => {
  const slug = await slugService.generateSlug(data.name, 'sport');

  return Sport.create({
    ...data,
    slug,
    status: data.status || 'published',
    icon: data.icon || DEFAULT_ICON,
    coverImage: data.coverImage || DEFAULT_COVER,
    competitionPathway: data.competitionPathway || { levels: [] },
    explorationGuidance: data.explorationGuidance || null,
    tournaments: data.tournaments || [],
    physicalBenefits: data.physicalBenefits || [],
    mentalBenefits: data.mentalBenefits || [],
    skillsDeveloped: data.skillsDeveloped || [],
    careerOpportunities: data.careerOpportunities || [],
    scholarships: data.scholarships || [],
    professionalLeagues: data.professionalLeagues || [],
    requiredEquipment: data.requiredEquipment || [],
    suitableFor: data.suitableFor || [],
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
// Returns the full sport including all fields.
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
const compareSports = async (sportId1, sportId2) => {
  const [s1, s2] = await Promise.all([
    Sport.findById(sportId1),
    Sport.findById(sportId2),
  ]);
  if (!s1 || !s2) throw new Error('One or both sports not found');

  const format = (s) => ({
    id:                    s._id,
    name:                  s.name,
    category:              s.category,
    sportType:             s.sportType,
    shortDescription:      s.shortDescription,
    fullDescription:       s.fullDescription,
    origin:                s.origin,
    beginnerFriendly:      s.beginnerFriendly,
    olympicSport:          s.olympicSport,
    estimatedMonthlyCost:  s.estimatedMonthlyCost,
    playingSeason:         s.playingSeason,
    trainingFrequency:     s.trainingFrequency,
    averageLearningTime:   s.averageLearningTime,
    injuryRisk:            s.injuryRisk,
    fitnessLevelRequired:  s.fitnessLevelRequired,
    suitableFor:           s.suitableFor,
    individualOrTeam:      s.individualOrTeam,
    indoorOutdoor:         s.indoorOutdoor,
    competitionPathway:    s.competitionPathway    || { levels: [] },
    explorationGuidance:   s.explorationGuidance   || null,
    icon:                  s.icon                  || DEFAULT_ICON,
    coverImage:            s.coverImage            || DEFAULT_COVER,
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
