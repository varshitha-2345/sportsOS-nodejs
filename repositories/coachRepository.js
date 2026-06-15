const Coach = require('../models/Coach');

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const getAllCoaches = async () => {
    return await Coach.find({ status: 'published' });
};

const getCoachById = async (id) => {
    return await Coach.findById(id);
};

const getCoachBySlug = async (slug) => {
    return await Coach.findOne({ slug });
};

const getCoachesFiltered = async ({ sport, search, page = 1, pageSize = 20 }) => {
    const query = { status: 'published' };

    if (sport) {
        const sports = sport.split(',').map(s => s.trim().toLowerCase());
        query.sportsCoached = { $in: sports };
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
    const data = await Coach.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);

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

const getCoachesByAcademy = async (academyId) => {
    return await Coach.find({ academyId, status: 'published' });
};

const getCoachesBySport = async (sport) => {
    return await Coach.find({
        sportsCoached: { $in: [sport.toLowerCase()] },
        status: 'published',
    });
};

const findDuplicate = async (name, academyId) => {
    return await Coach.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        academyId,
    });
};

const createCoach = async (data) => {
    const coach = new Coach(data);
    return await coach.save();
};

const updateCoach = async (id, data) => {
    return await Coach.findByIdAndUpdate(id, data, { new: true });
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
