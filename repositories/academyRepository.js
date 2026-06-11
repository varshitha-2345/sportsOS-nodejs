const Academy = require('../models/Academy');

// Get all academies
const getAllAcademies = async () => {
    return await Academy.find();
};

// Get academy by ID
const getAcademyById = async (id) => {
    return await Academy.findById(id);
};

// Get academies by sport — works for both old string data AND new array data
// Single:   "Cricket"
// Multiple: "Cricket,Football"
const getAcademiesBySport = async (sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim());
    const regexList = sports.map(s => new RegExp(`^${s}$`, 'i'));
    return await Academy.find({
        $or: [
            { sport: { $elemMatch: { $in: regexList } } },  // new array data
            { sport: { $in: regexList } }                   // old string data
        ]
    });
};

// Get academies within max distance
const getAcademiesByDistance = async (maxKm) => {
    return await Academy.find({ distanceKm: { $lte: parseFloat(maxKm) } });
};

// Get academies by distance AND sport combined
const getAcademiesByDistanceAndSport = async (maxKm, sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim());
    const regexList = sports.map(s => new RegExp(`^${s}$`, 'i'));
    return await Academy.find({
        distanceKm: { $lte: parseFloat(maxKm) },
        $or: [
            { sport: { $elemMatch: { $in: regexList } } },  // new array data
            { sport: { $in: regexList } }                   // old string data
        ]
    });
};

// Get verified academies (all)
const getVerifiedAcademies = async () => {
    return await Academy.find({ verified: true });
};

// Get verified academies within max distance
const getVerifiedAcademiesByDistance = async (maxKm) => {
    return await Academy.find({
        verified: true,
        distanceKm: { $lte: parseFloat(maxKm) }
    });
};

// Get academies by goal type with optional sport + distance filters
const getAcademiesByGoal = async (goalType, filters = {}) => {
    const query = {};
    if (goalType === 'short-term') query.goalType = { $in: ['short-term', 'both'] };
    else if (goalType === 'long-term') query.goalType = { $in: ['long-term', 'both'] };
    if (filters.sport) {
        const sports = filters.sport.split(',').map(s => s.trim());
        const regexList = sports.map(s => new RegExp(`^${s}$`, 'i'));
        query.$or = [
            { sport: { $elemMatch: { $in: regexList } } },
            { sport: { $in: regexList } }
        ];
    }
    if (filters.maxKm) query.distanceKm = { $lte: parseFloat(filters.maxKm) };
    return await Academy.find(query);
};

// Check duplicate academy
const findDuplicate = async (name, sport, location) => {
    return await Academy.findOne({
        name:     { $regex: new RegExp(`^${name}$`, 'i') },
        location: { $regex: new RegExp(`^${location}$`, 'i') }
    });
};

// Create new academy
const createAcademy = async (data) => {
    const academy = new Academy(data);
    return await academy.save();
};

// Update academy by ID
const updateAcademy = async (id, data) => {
    return await Academy.findByIdAndUpdate(id, data, { new: true });
};

// Delete academy by ID
const deleteAcademy = async (id) => {
    return await Academy.findByIdAndDelete(id);
};

module.exports = {
    getAllAcademies,
    getAcademyById,
    getAcademiesBySport,
    getAcademiesByDistance,
    getAcademiesByDistanceAndSport,
    getVerifiedAcademies,
    getVerifiedAcademiesByDistance,
    getAcademiesByGoal,
    findDuplicate,
    createAcademy,
    updateAcademy,
    deleteAcademy
};