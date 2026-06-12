// ============================================================
// services/locationService.js
// Saves user location and finds nearby academies/coaches
// using MongoDB's geospatial ($near) queries.
// ============================================================

const User    = require('../models/User');
const Academy = require('../models/Academy');
const Coach   = require('../models/Coach');

// ─── SAVE USER LOCATION ──────────────────────────────────────
// Saves the user's GPS coordinates and address details to their profile.
// Called when user enables location on the app.
const saveLocation = async (userId, { lat, lng, city, state, pincode }) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      // GeoJSON Point format required by MongoDB for geospatial queries
      location: { type: 'Point', coordinates: [lng, lat] }, // NOTE: lng first, lat second!
      city,
      state,
      pincode,
    },
    { new: true }
  );
  if (!user) throw new Error('User not found');
  return user;
};

// ─── GET NEARBY ACADEMIES ─────────────────────────────────────
// Finds academies within radiusKm kilometers of a given GPS point.
// Uses MongoDB's $near operator (requires 2dsphere index on location field).
const getNearbyAcademies = async ({ lat, lng, radiusKm = 10, sport, limit = 20 }) => {
  const filter = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] }, // center point
        $maxDistance: radiusKm * 1000, // MongoDB uses meters, so convert km → meters
      },
    },
    isVerified: true, // Only show admin-approved academies
  };
  if (sport) filter.sports = sport; // Optional: filter by sport

  return Academy.find(filter).limit(limit);
};

// ─── GET NEARBY COACHES ──────────────────────────────────────
// Same as getNearbyAcademies but for coaches.
const getNearbyCoaches = async ({ lat, lng, radiusKm = 10, sport, limit = 20 }) => {
  const filter = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000,
      },
    },
    isVerified: true,
  };
  if (sport) filter.sports = sport;

  return Coach.find(filter).limit(limit);
};

module.exports = { saveLocation, getNearbyAcademies, getNearbyCoaches };
