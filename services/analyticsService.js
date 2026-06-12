// ============================================================
// services/analyticsService.js
// Tracks user behaviour events for the admin analytics dashboard.
//
// Frontend alignment:
//   - lib/analytics/events.ts defines: pageViewEvent, searchSubmitEvent, enquirySubmitEvent
//   - lib/analytics/client.ts batches and POSTs events to /api/events
//   - app/api/events/route.ts is the Next.js endpoint that calls this service
//   - app/(admin)/admin/analytics/page.tsx shows the dashboard
//
// Event names used by frontend:
//   - 'page.view'      → route, referrer
//   - 'search.submit'  → query, resultsCount, filters, location
//   - 'enquiry.submit' → entity, id, intent, sport, city, leadId
//
// Previous event names (kept for backward compat):
//   - 'search'         → maps to 'search.submit'
//   - 'profile_view'   → maps to 'page.view'
//   - 'shortlist'      → maps to 'shortlist.action'
// ============================================================

const Analytics = require('../models/Analytics');

// ─── TRACK BATCH EVENTS ──────────────────────────────────────
// Handles a batch of events from the frontend analytics client.
// Called by app/api/events/route.ts POST handler.
// events: Array<{ name, properties, ts, userId? }>
const trackBatch = async ({ events, userId }) => {
  if (!Array.isArray(events) || events.length === 0) return;

  const docs = events.map((ev) => ({
    event:     ev.name,
    userId:    userId || ev.userId || null,
    data:      ev.properties || {},
    createdAt: ev.ts ? new Date(ev.ts) : new Date(),
  }));

  await Analytics.insertMany(docs);
  return { tracked: docs.length };
};

// ─── TRACK PAGE VIEW ─────────────────────────────────────────
// Records a page view event.
// Matches pageViewEvent() in lib/analytics/events.ts
const trackPageView = async ({ userId, route, referrer }) => {
  return Analytics.create({
    event:  'page.view',
    userId: userId || null,
    data:   { route, referrer: referrer || null },
  });
};

// ─── TRACK SEARCH ────────────────────────────────────────────
// Records a search submission with query, result count, and filters.
// Matches searchSubmitEvent() in lib/analytics/events.ts
const trackSearch = async ({ userId, query, resultsCount, filters, location }) => {
  return Analytics.create({
    event:  'search.submit',
    userId: userId || null,
    data:   { query, resultsCount: resultsCount || 0, filters: filters || {}, location: location || null },
  });
};

// ─── TRACK ENQUIRY SUBMIT ─────────────────────────────────────
// Records when a user submits an enquiry form.
// Matches enquirySubmitEvent() in lib/analytics/events.ts
const trackEnquirySubmit = async ({ userId, entity, id, intent, sport, city, leadId }) => {
  return Analytics.create({
    event:  'enquiry.submit',
    userId: userId || null,
    data:   { entity, id, intent, sport, city, leadId },
  });
};

// ─── TRACK PROFILE VIEW ──────────────────────────────────────
// Records when a user opens an academy/coach/sport detail page.
// Kept for backward compatibility; newer code uses trackPageView with route.
const trackProfileView = async ({ userId, targetId, targetType }) => {
  return Analytics.create({
    event:  'profile_view',
    userId: userId || null,
    data:   { targetId, targetType },
  });
};

// ─── TRACK SHORTLIST ACTION ──────────────────────────────────
// Records when a user adds or removes an item from their shortlist.
// action: 'add' | 'remove'
const trackShortlist = async ({ userId, itemId, itemType, action }) => {
  return Analytics.create({
    event:  'shortlist.action',
    userId,
    data:   { itemId, itemType, action },
  });
};

// ─── GET DASHBOARD ANALYTICS ─────────────────────────────────
// Aggregates event counts grouped by event type for the admin dashboard.
// Matches app/(admin)/admin/analytics/page.tsx
// Returns: { 'page.view': 540, 'search.submit': 320, 'enquiry.submit': 48, ... }
const getDashboardAnalytics = async ({ from, to } = {}) => {
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to)   dateFilter.$lte = new Date(to);

  const matchStage = Object.keys(dateFilter).length
    ? { $match: { createdAt: dateFilter } }
    : { $match: {} };

  const stats = await Analytics.aggregate([
    matchStage,
    { $group: { _id: '$event', count: { $sum: 1 } } },
  ]);

  // Convert [{_id:'search.submit', count:5}] → {'search.submit': 5}
  return stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});
};

// ─── GET TOP SEARCHES ────────────────────────────────────────
// Returns the most common search queries (for admin analytics insight).
// Useful to understand what parents/athletes are looking for.
const getTopSearches = async ({ limit = 10, from, to } = {}) => {
  const matchFilter = { event: 'search.submit' };
  if (from || to) {
    matchFilter.createdAt = {};
    if (from) matchFilter.createdAt.$gte = new Date(from);
    if (to)   matchFilter.createdAt.$lte = new Date(to);
  }

  return Analytics.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$data.query', count: { $sum: 1 } } },
    { $sort:  { count: -1 } },
    { $limit: limit },
  ]);
};

module.exports = {
  trackBatch,
  trackPageView,
  trackSearch,
  trackEnquirySubmit,
  trackProfileView,
  trackShortlist,
  getDashboardAnalytics,
  getTopSearches,
};
