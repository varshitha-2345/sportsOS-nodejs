const { mapCoach } = require('../utils/coachMapper');
const Coach = require('../models/Coach');

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const getAllCoaches = async () => {
    const docs = await Coach.find({ status: 'published' });
    return docs.map(mapCoach);
};

const getCoachById = async (id) => {
    const doc = await Coach.findById(id);
    return mapCoach(doc);
};

const getCoachBySlug = async (slug) => {
    const doc = await Coach.findOne({ slug });
    return mapCoach(doc);
};

const getCoachesFiltered = async ({ sport, city, experienceYears, search, page = 1, pageSize = 20 }) => {
    const query = { status: 'published' };

    if (sport) {
        const sports = sport.split(',').map(s => s.trim().toLowerCase());
        query.sportsCoached = { $in: sports };
    }

    if (city) {
        const cities = city.split(',').map(c => c.trim());
        query['location.city'] = { $in: cities.map(c => new RegExp(escapeRegex(c), 'i')) };
    }

    if (experienceYears) {
        const parts = experienceYears.split('-').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            query.experienceYears = { $gte: parts[0], $lte: parts[1] };
        } else if (parts.length === 1 && !isNaN(parts[0])) {
            query.experienceYears = { $gte: parts[0] };
        }
    }

    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        query.$or = [
            { name: regex },
            { 'location.city': regex },
            { 'location.state': regex },
            { sportsCoached: { $in: [regex] } },
            { specialization: { $in: [regex] } },
        ];
    }

    const total = await Coach.countDocuments(query);
    const skip = (page - 1) * pageSize;
    const data = await Coach.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    return {
        items: data.map(mapCoach),
        pagination: {
            page,
            pageSize,
            total,
            hasMore: skip + data.length < total,
        },
    };
};

const getCoachesByAcademy = async (academyId) => {
    const docs = await Coach.find({
        academyId,
        status: 'published',
    });

    return docs.map(mapCoach);
};

const getCoachesBySport = async (sport) => {
    const docs = await Coach.find({
        sportsCoached: { $in: [sport.toLowerCase()] },
        status: 'published',
    });

    return docs.map(mapCoach);
};

const findDuplicate = async (name, academyId) => {
    return await Coach.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        academyId,
    });
};

const createCoach = async (data) => {
    const coach = new Coach(data);
    const saved = await coach.save();
    return mapCoach(saved);
};

const updateCoach = async (id, data) => {
    const updated = await Coach.findByIdAndUpdate(id, data, {
        new: true,
    });

    return mapCoach(updated);
};

const deleteCoach = async (id) => {
    return await Coach.findByIdAndDelete(id);
};

const deleteAll = async () => {
    return await Coach.deleteMany({});
};

module.exports = {
    getAllCoaches,
    getCoachById,
    getCoachBySlug,
    getCoachesFiltered,
    getCoachesByAcademy,
    getCoachesBySport,
    findDuplicate,
    createCoach,
    updateCoach,
    deleteCoach,
    deleteAll,
};
