const Athlete = require('../models/Athlete');

// Get all athletes
const getAllAthletes = async () => {
    return await Athlete.find();
};

// Get athlete by ID
const getAthleteById = async (id) => {
    return await Athlete.findById(id);
};

// Get athletes by sport — works for both old string data AND new array data
// Single:   "Cricket"
// Multiple: "Cricket,Football"
const getAthletesBySport = async (sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim());
    const regexList = sports.map(s => new RegExp(`^${s}$`, 'i'));
    return await Athlete.find({
        $or: [
            { sport: { $elemMatch: { $in: regexList } } },  // new array data
            { sport: { $in: regexList } }                   // old string data
        ]
    });
};

// Get athletes within max distance
const getAthletesByDistance = async (maxKm) => {
    return await Athlete.find({ distanceKm: { $lte: parseFloat(maxKm) } });
};

// Get athletes by distance AND sport combined
const getAthletesByDistanceAndSport = async (maxKm, sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim());
    const regexList = sports.map(s => new RegExp(`^${s}$`, 'i'));
    return await Athlete.find({
        distanceKm: { $lte: parseFloat(maxKm) },
        $or: [
            { sport: { $elemMatch: { $in: regexList } } },  // new array data
            { sport: { $in: regexList } }                   // old string data
        ]
    });
};

// Get athletes by goal type with optional sport + distance filters
const getAthletesByGoal = async (goalType, filters = {}) => {
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
    return await Athlete.find(query);
};

// Check duplicate athlete
const findDuplicate = async (name, sport, age, academy) => {
    return await Athlete.findOne({
        name:    { $regex: new RegExp(`^${name}$`, 'i') },
        academy: { $regex: new RegExp(`^${academy}$`, 'i') },
        age:     age
    });
};

// Create new athlete
const createAthlete = async (data) => {
    const athlete = new Athlete(data);
    return await athlete.save();
};

// Update athlete by ID
const updateAthlete = async (id, data) => {
    return await Athlete.findByIdAndUpdate(id, data, { new: true });
};

// Delete athlete by ID
const deleteAthlete = async (id) => {
    return await Athlete.findByIdAndDelete(id);
};

module.exports = {
    getAllAthletes,
    getAthleteById,
    getAthletesBySport,
    getAthletesByDistance,
    getAthletesByDistanceAndSport,
    getAthletesByGoal,
    findDuplicate,
    createAthlete,
    updateAthlete,
    deleteAthlete
};