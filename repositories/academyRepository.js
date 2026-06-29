const { mapAcademy } = require('../utils/academyMapper');
const Academy = require('../models/Academy');

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const getAllAcademies = async () => {
    const docs = await Academy.find({});
    return docs.map(mapAcademy);
};

const getAcademyById = async (id) => {
    const doc = await Academy.findById(id);
    return mapAcademy(doc);
};

const getAcademyBySlug = async (slug) => {
    const doc = await Academy.findOne({ slug });
    return mapAcademy(doc);
};

const getAcademiesFiltered = async ({ sport, facility, search, page = 1, pageSize = 20 }) => {
    const query = {};

    if (sport) {
        const sports = sport.split(',').map(s => s.trim());
        const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
        query.sport = { $in: regexList };
    }

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
    const data = await Academy.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    return {
        items: data.map(mapAcademy),
        pagination: {
            page,
            pageSize,
            total,
            hasMore: skip + data.length < total,
        },
    };
};

const getAcademiesBySport = async (sportParam) => {
    const sports = sportParam.split(',').map(s => s.trim());
    const regexList = sports.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i'));
    const docs = await Academy.find({ sport: { $in: regexList } });
    return docs.map(mapAcademy);
};

const getVerifiedAcademies = async () => {
    const docs = await Academy.find({ verified: true });
    return docs.map(mapAcademy);
};

const findDuplicate = async (name, city) => {
    return await Academy.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') },
    });
};

// ✅ Modified
const createAcademy = async (data) => {
    if (typeof data.facilities === 'string') {
        data.facilities = data.facilities
            .split(',')
            .map(item => item.trim());
    }

    const academy = new Academy(data);
    const saved = await academy.save();
    return mapAcademy(saved);
};

// ✅ Modified
const updateAcademy = async (id, data) => {
    if (typeof data.facilities === 'string') {
        data.facilities = data.facilities
            .split(',')
            .map(item => item.trim());
    }

    const updated = await Academy.findByIdAndUpdate(id, data, {
        new: true,
    });

    return mapAcademy(updated);
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
