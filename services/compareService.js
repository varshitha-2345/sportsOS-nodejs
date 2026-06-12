// ============================================================
// services/compareService.js
// Provides structured side-by-side comparison data for
// academies and coaches — used on the Compare feature pages.
// ============================================================

const Academy = require('../models/Academy');
const Coach   = require('../models/Coach');

// ─── COMPARE ACADEMIES ───────────────────────────────────────
// Fetches two academies and returns them in a uniform format for comparison.
const compareAcademies = async (academyId1, academyId2) => {
  // Fetch both in parallel
  const [a1, a2] = await Promise.all([
    Academy.findById(academyId1).populate('facilities').populate('images'),
    Academy.findById(academyId2).populate('facilities').populate('images'),
  ]);
  if (!a1 || !a2) throw new Error('One or both academies not found');

  // Helper function to shape the data consistently for both academies
  const format = (a) => ({
    id:          a._id,
    name:        a.name,
    city:        a.city,
    sports:      a.sports,       // list of sports offered
    facilities:  a.facilities,   // populated AcademyFacility docs
    avgRating:   a.avgRating,
    reviewCount: a.reviewCount,
    feeRange:    a.feeRange,
    isVerified:  a.isVerified,
    images:      a.images,       // gallery images
  });

  return { academy1: format(a1), academy2: format(a2) };
};

// ─── COMPARE COACHES ─────────────────────────────────────────
// Same pattern as compareAcademies but for coaches.
const compareCoaches = async (coachId1, coachId2) => {
  const [c1, c2] = await Promise.all([
    Coach.findById(coachId1).populate('certificates'),
    Coach.findById(coachId2).populate('certificates'),
  ]);
  if (!c1 || !c2) throw new Error('One or both coaches not found');

  const format = (c) => ({
    id:             c._id,
    name:           c.name,
    experience:     c.experience,  // years
    sports:         c.sports,
    city:           c.city,
    avgRating:      c.avgRating,
    reviewCount:    c.reviewCount,
    certifications: c.certificates, // populated CoachCertificate docs
    feeRange:       c.feeRange,
    isVerified:     c.isVerified,
  });

  return { coach1: format(c1), coach2: format(c2) };
};

module.exports = { compareAcademies, compareCoaches };
