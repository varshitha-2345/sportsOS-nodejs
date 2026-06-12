const Academy = require('../models/Academy');

const getAllAcademies = async () => {
    return await Academy.find({ status: 'published' });
};

const getAcademyById = async (id) => {
    return await Academy.findById(id);
};

const getAcademyBySlug = async (slug) => {
    return await Academy.findOne({ slug });
};

const getAcademiesFiltered = async ({ sport, facility, level, status, search, page = 1, pageSize = 20 }) => {
    const query = { status: 'published' };

    if (sport) {
        const sports = sport.split(',').map(s => s.trim().toLowerCase());
        query.sportsOffered = { $in: sports };
    }

    if (facility) {
        const facilities = facility.split(',').map(f => f.trim());
        query.facilities = { $all: facilities };
    }

    if (level) {
        const levels = level.split(',').map(l => l.trim());
        query.trainingLevels = { $in: levels };
    }

    if (status) {
        const statuses = status.split(',').map(s => s.trim());
        query.verificationStatus = { $in: statuses };
    }

    if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
            { name: regex },
            { description: regex },
            { 'location.city': regex },
            { 'location.state': regex },
            { sportsOffered: { $in: [regex] } },
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

const getAcademiesBySport = async (sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim().toLowerCase());
    return await Academy.find({ sportsOffered: { $in: sports }, status: 'published' });
};

const getVerifiedAcademies = async () => {
    return await Academy.find({ verificationStatus: 'verified', status: 'published' });
};

const findDuplicate = async (name, city) => {
    return await Academy.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        'location.city': { $regex: new RegExp(`^${city}$`, 'i') },
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
