const Shortlist = require('../models/Shortlist');

// Get all shortlist
const getAllShortlist = async () => {
    return await Shortlist.find();
};

// Get shortlist item by ID
const getShortlistById = async (id) => {
    return await Shortlist.findById(id);
};

// Get shortlist by athleteId
const getShortlistByAthlete = async (athleteId) => {
    return await Shortlist.find({ athleteId });
};

// Check duplicate shortlist
const findDuplicate = async (athleteId, academyId) => {
    return await Shortlist.findOne({ athleteId, academyId });
};

// Create shortlist item
const createShortlist = async (data) => {
    const item = new Shortlist(data);
    return await item.save();
};

// Delete shortlist item by ID
const deleteShortlist = async (id) => {
    return await Shortlist.findByIdAndDelete(id);
};

module.exports = {
    getAllShortlist,
    getShortlistById,
    getShortlistByAthlete,
    findDuplicate,
    createShortlist,
    deleteShortlist
};