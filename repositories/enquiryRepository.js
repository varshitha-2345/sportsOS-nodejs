const Enquiry = require('../models/Enquiry');

const create = async (data) => {
    const item = new Enquiry(data);
    return await item.save();
};

const findByUser = async (userId) => {
    return await Enquiry.find({ userId }).sort({ createdAt: -1 });
};

const findAll = async () => {
    return await Enquiry.find().sort({ createdAt: -1 });
};

const findById = async (id) => {
    return await Enquiry.findById(id);
};

module.exports = { create, findByUser, findAll, findById };
