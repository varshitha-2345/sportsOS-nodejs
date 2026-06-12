// ============================================================
// services/slugService.js
// Generates unique URL-friendly slugs for academies, coaches, and sports.
// Example: "Sportz Village" → "sportz-village"
//          If taken: "sportz-village-1", "sportz-village-2", ...
// ============================================================

const Academy = require('../models/Academy');
const Coach   = require('../models/Coach');
const Sport   = require('../models/Sport');

// Maps entity type strings to their Mongoose models
const modelMap = {
  academy: Academy,
  coach:   Coach,
  sport:   Sport,
};

// ─── GENERATE SLUG ───────────────────────────────────────────
// Takes a name + entity type, creates a URL-safe slug, and ensures it's unique.
const generateSlug = async (name, type = 'academy') => {
  const Model = modelMap[type];
  if (!Model) throw new Error('Invalid entity type for slug');

  // Step 1: Clean the name into a base slug
  const base = name
    .toLowerCase()                       // "Sportz Village FC" → "sportz village fc"
    .trim()                              // Remove leading/trailing spaces
    .replace(/[^a-z0-9\s-]/g, '')       // Remove special characters (keep letters, numbers, spaces, hyphens)
    .replace(/\s+/g, '-')               // Replace spaces with hyphens
    .replace(/-+/g, '-');               // Collapse multiple hyphens into one

  // Step 2: Ensure uniqueness — keep incrementing a counter until slug is available
  let slug    = base;
  let counter = 1;

  while (await Model.exists({ slug })) {
    // If "sportz-village" already exists, try "sportz-village-1", then "sportz-village-2", etc.
    slug = `${base}-${counter}`;
    counter++;
  }

  return slug; // This slug is guaranteed to be unique in the collection
};

module.exports = { generateSlug };
