const Coach = require('../models/Coach');

// Get all coaches
const getAllCoaches = async () => {
    return await Coach.find();
};

// Get coach by ID
const getCoachById = async (id) => {
    return await Coach.findById(id);
};

// Get coaches by academyId
const getCoachesByAcademy = async (academyId) => {
    return await Coach.find({ academyId });
};

// Get coaches by sport
const getCoachesBySport = async (sport) => {
    return await Coach.find({
        sport: { $regex: new RegExp(`^${sport}$`, 'i') }
    });
};

// Check duplicate coach
const findDuplicate = async (name, sport, academyId) => {
    return await Coach.findOne({
        name:      { $regex: new RegExp(`^${name}$`, 'i') },
        sport:     { $regex: new RegExp(`^${sport}$`, 'i') },
        academyId: academyId
    });
};

// Create new coach
const createCoach = async (data) => {
    const coach = new Coach(data);
    return await coach.save();
};

// Delete coach by ID
const deleteCoach = async (id) => {
    return await Coach.findByIdAndDelete(id);
};

module.exports = {
    getAllCoaches,
    getCoachById,
    getCoachesByAcademy,
    getCoachesBySport,
    findDuplicate,
    createCoach,
    deleteCoach
};