const Shortlist = require('../models/Shortlist');

const findByUser = async (userId) => {
    return await Shortlist.find({ userId }).sort({ createdAt: -1 });
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

const removeAllByUser = async (userId) => {
    return await Shortlist.deleteMany({ userId });
};

module.exports = { findByUser, findDuplicate, create, remove, removeAllByUser };
