const Athlete = require('../models/Athlete');

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get all athletes
const getAllAthletes = async () => {
    return await Athlete.find();
};

// Get athletes with filtering + pagination
const getAthletesFiltered = async ({ sport, page = 1, pageSize = 20 }) => {
    const query = {};

    if (sport) {
        const sports = sport.split(',').map(s => s.trim());
        const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
        query.$or = [
            { sport: { $elemMatch: { $in: regexList } } },
            { sport: { $in: regexList } },
        ];
    }

    const total = await Athlete.countDocuments(query);
    const skip = (page - 1) * pageSize;
    const data = await Athlete.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);

    return {
        items: data,
        pagination: {
            page,
            pageSize,
            total,
            hasMore: skip + data.length < total,
        },
    };
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
    const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
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
    const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
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
        const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
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
        name:    { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        academy: { $regex: new RegExp(`^${escapeRegex(academy)}$`, 'i') },
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
    getAthletesFiltered,
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