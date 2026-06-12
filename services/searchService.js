// ============================================================
// services/searchService.js
// Unified search across academies, coaches, and sports.
//
// Frontend alignment:
//   - types/api/index.ts: SearchSuggestRequest, SearchSuggestResponse
//     SearchSuggestRequest: { query, entity?, limit? }
//     SearchSuggestResponse: { suggestions: [{ entity, id, slug, label, sublabel? }] }
//   - components/command/command-palette.tsx: uses suggest endpoint
//   - app/(public)/search/page.tsx: uses searchAll
//   - components/ui/search-input.tsx: autocomplete suggestions
// ============================================================

const Academy = require('../models/Academy');
const Coach   = require('../models/Coach');
const Sport   = require('../models/Sport');

// ─── SEARCH SUGGEST ──────────────────────────────────────────
// Returns quick autocomplete suggestions for the command palette and search bar.
// Matches SearchSuggestRequest/Response in types/api/index.ts
// entity: 'academy' | 'coach' | 'sport' | 'all'
const searchSuggest = async ({ query, entity = 'all', limit = 5 }) => {
  if (!query || query.trim().length < 2) return { suggestions: [] };

  const textFilter  = { $text: { $search: query } };
  const regexFilter = { name: new RegExp(query, 'i') };

  const results = [];

  if (entity === 'all' || entity === 'academy') {
    const academies = await Academy.find({
      ...textFilter,
      isVerified: true,
      status: 'published',
    }).limit(limit).lean();

    academies.forEach((a) => results.push({
      entity:   'academy',
      id:       a._id.toString(),
      slug:     a.slug,
      label:    a.name,
      sublabel: a.city || undefined,
    }));
  }

  if (entity === 'all' || entity === 'coach') {
    const coaches = await Coach.find({
      ...textFilter,
      isVerified: true,
      status: 'published',
    }).limit(limit).lean();

    coaches.forEach((c) => results.push({
      entity:   'coach',
      id:       c._id.toString(),
      slug:     c.slug,
      label:    c.name,
      sublabel: c.city || undefined,
    }));
  }

  if (entity === 'all' || entity === 'sport') {
    // Sports don't have a text index — use regex
    const sports = await Sport.find({
      ...regexFilter,
      status: 'published',
    }).limit(limit).lean();

    sports.forEach((s) => results.push({
      entity:   'sport',
      id:       s._id.toString(),
      slug:     s.slug,
      label:    s.name,
      sublabel: s.category || undefined,
    }));
  }

  return { suggestions: results.slice(0, limit) };
};

// ─── SEARCH ALL ──────────────────────────────────────────────
// Single query that searches across all three entity types at once.
// Used for the global search page: app/(public)/search/page.tsx
const searchAll = async ({ query, page = 1, limit = 10 }) => {
  if (!query) throw new Error('Search query is required');

  const skip       = (page - 1) * limit;
  const textFilter = { $text: { $search: query } };

  const [academies, coaches, sports] = await Promise.all([
    Academy.find({ ...textFilter, isVerified: true, status: 'published' })
           .limit(limit).lean(),
    Coach.find({ ...textFilter, isVerified: true, status: 'published' })
         .limit(limit).lean(),
    Sport.find({ name: new RegExp(query, 'i'), status: 'published' })
         .limit(limit).lean(),
  ]);

  // Tag each result with _type so the frontend knows which card to render
  return {
    academies: academies.map((a) => ({ ...a, _type: 'academy' })),
    coaches:   coaches.map((c)   => ({ ...c, _type: 'coach'   })),
    sports:    sports.map((s)    => ({ ...s, _type: 'sport'   })),
  };
};

// ─── SEARCH ACADEMIES (dedicated) ────────────────────────────
// Academy-only search with full filter support.
const searchAcademies = async ({
  query, city, sport, trainingLevel, facility,
  page = 1, limit = 10,
}) => {
  const filter = { isVerified: true, status: 'published' };
  if (query)         filter.$text          = { $search: query };
  if (city)          filter.city           = new RegExp(city, 'i');
  if (sport)         filter.sportsOffered  = sport;
  if (trainingLevel) filter.trainingLevels = trainingLevel;
  if (facility)      filter.facilities     = facility;

  const skip = (page - 1) * limit;
  const [results, total] = await Promise.all([
    Academy.find(filter).skip(skip).limit(limit),
    Academy.countDocuments(filter),
  ]);

  return { results, total, page, pages: Math.ceil(total / limit) };
};

// ─── SEARCH COACHES (dedicated) ──────────────────────────────
const searchCoaches = async ({
  query, sport, city, specialization,
  page = 1, limit = 10,
}) => {
  const filter = { isVerified: true, status: 'published' };
  if (query)          filter.$text         = { $search: query };
  if (sport)          filter.sportsCoached = sport;
  if (city)           filter.city          = new RegExp(city, 'i');
  if (specialization) filter.specialization = specialization;

  const skip = (page - 1) * limit;
  const [results, total] = await Promise.all([
    Coach.find(filter).skip(skip).limit(limit),
    Coach.countDocuments(filter),
  ]);

  return { results, total, page, pages: Math.ceil(total / limit) };
};

// ─── SEARCH SPORTS ───────────────────────────────────────────
// Name + category filter for the sports listing page.
// Matches app/(public)/sports/page.tsx
const searchSports = async ({ query, category } = {}) => {
  const filter = { status: 'published' };
  if (query)    filter.name     = new RegExp(query, 'i');
  if (category) filter.category = category;
  return Sport.find(filter).sort({ name: 1 });
};

module.exports = {
  searchSuggest,
  searchAll,
  searchAcademies,
  searchCoaches,
  searchSports,
};
