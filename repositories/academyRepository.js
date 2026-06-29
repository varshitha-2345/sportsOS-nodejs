const Academy = require('../models/Academy');

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get all academies — no status filter, since her data has no 'status' field
const getAllAcademies = async () => {
    return await Academy.find({});
};

const getAcademyById = async (id) => {
    return await Academy.findById(id);
};

const getAcademyBySlug = async (slug) => {
    return await Academy.findOne({ slug });
};

// Filtered + paginated search — matches her real field names
const getAcademiesFiltered = async ({ sport, facility, search, page = 1, pageSize = 20 }) => {
    const query = {};

    // sport is a single string field (e.g. "Cricket"), not an array
    if (sport) {
        const sports = sport.split(',').map(s => s.trim());
        const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
        query.sport = { $in: regexList };
    }

    // facilities is a single comma-separated string, e.g. "Gym, Practice Pitch, Bowling Machine"
    if (facility) {
        const facilities = facility.split(',').map(f => f.trim());
        const regexList = facilities.map(f => new RegExp(escapeRegex(f), 'i'));
        query.facilities = { $in: regexList };
    }

    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        query.$or = [
            { name: regex },
            { description: regex },
            { city: regex },
            { state: regex },
            { sport: regex },
        ];
    }

    const total = await Academy.countDocuments(query);
    const skip = (page - 1) * pageSize;
    const data = await Academy.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);

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

// sport is a single string in her data — use case-insensitive exact match
const getAcademiesBySport = async (sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim());
    const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
    return await Academy.find({ sport: { $in: regexList } });
};

// her field is called "verified" (boolean), not "verificationStatus"
const getVerifiedAcademies = async () => {
    return await Academy.find({ verified: true });
};

const findDuplicate = async (name, city) => {
    return await Academy.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') },
    });
};

const createAcademy = async (data) => {
    const academy = new Academy(data);
    return await academy.save();
};

const updateAcademy = async (id, data) => {
    return await Academy.findByIdAndUpdate(id, data, { new: true });
};

const deleteAcademy = async (id) => {
    return await Academy.findByIdAndDelete(id);
};

const deleteAll = async () => {
    return await Academy.deleteMany({});
};

module.exports = {
    getAllAcademies,
    getAcademyById,
    getAcademyBySlug,
    getAcademiesFiltered,
    getAcademiesBySport,
    getVerifiedAcademies,
    findDuplicate,
    createAcademy,
    updateAcademy,
    deleteAcademy,
    deleteAll,
};