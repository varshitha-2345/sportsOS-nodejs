const Review = require('../models/Review');

const create = async (data) => {
    const item = new Review(data);
    return await item.save();
};

const findByTarget = async (targetId, targetType, { sort = '-createdAt', limit = 50, skip = 0 } = {}) => {
    return await Review.find({ targetId, targetType, moderationStatus: 'approved' })
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .populate('userId', 'name avatar');
};

const findByUser = async (userId) => {
    return await Review.find({ userId }).sort({ createdAt: -1 });
};

const findById = async (id) => {
    return await Review.findById(id).populate('userId', 'name avatar');
};

const findForUser = async (userId, targetId, targetType) => {
    return await Review.findOne({ userId, targetId, targetType });
};

const updateById = async (id, data) => {
    return await Review.findByIdAndUpdate(id, data, { new: true });
};

const deleteById = async (id) => {
    return await Review.findByIdAndDelete(id);
};

const getStats = async (targetId, targetType) => {
    const result = await Review.aggregate([
        { $match: { targetId: require('mongoose').Types.ObjectId.createFromHexString(targetId), targetType, moderationStatus: 'approved' } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                ratingDistribution: { $push: '$rating' },
            },
        },
    ]);

    if (result.length === 0) {
        return { averageRating: 0, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const { averageRating, totalReviews, ratingDistribution } = result[0];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratingDistribution) {
        distribution[r] = (distribution[r] || 0) + 1;
    }

    return { averageRating: Math.round(averageRating * 10) / 10, totalReviews, distribution };
};

module.exports = { create, findByTarget, findByUser, findById, findForUser, updateById, deleteById, getStats };
