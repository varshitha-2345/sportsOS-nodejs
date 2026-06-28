const Shortlist = require('../models/Shortlist');

const findByUser = async (userId) => {
    return await Shortlist.find({ userId }).sort({ createdAt: -1 });
};

const findById = async (id) => {
    return await Shortlist.findById(id);
};

const findByUserAndItem = async (userId, itemType, itemId) => {
    return await Shortlist.findOne({ userId, itemType, itemId });
};

const findDuplicate = async (userId, itemType, itemId) => {
    return await Shortlist.findOne({ userId, itemType, itemId });
};

const create = async (userId, itemType, itemId) => {
    const item = new Shortlist({ userId, itemType, itemId });
    return await item.save();
};

const remove = async (id) => {
    return await Shortlist.findByIdAndDelete(id);
};

const removeByUserAndItem = async (userId, itemType, itemId) => {
    return await Shortlist.findOneAndDelete({ userId, itemType, itemId });
};

const clearByUser = async (userId) => {
    return await Shortlist.deleteMany({ userId });
};

const existsForUser = async (userId, itemType, itemId) => {
    const item = await Shortlist.findOne({ userId, itemType, itemId });
    return !!item;
};

module.exports = {
    findByUser,
    findById,
    findByUserAndItem,
    findDuplicate,
    create,
    remove,
    removeByUserAndItem,
    clearByUser,
    existsForUser,
};
