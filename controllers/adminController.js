const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const Academy = require('../models/Academy');
const Coach = require('../models/Coach');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Sport = require('../models/Sport');
const { ok, fail } = require('../utils/response');
const { clampPage, clampPageSize } = require('../utils/validation');

router.get('/dashboard/stats', protect, adminOnly, async (req, res) => {
  try {
    const [
      totalAcademies,
      totalCoaches,
      totalUsers,
      pendingVerifications,
      totalEnquiries,
    ] = await Promise.all([
      Academy.countDocuments(),
      Coach.countDocuments(),
      User.countDocuments(),
      Academy.countDocuments({ verificationStatus: 'pending' }),
      Enquiry.countDocuments(),
    ]);

    res.json(ok({
      totalAcademies,
      totalCoaches,
      totalUsers,
      pendingVerifications,
      totalEnquiries,
    }));
  } catch (err) {
    res.status(500).json(fail('SERVER_ERROR', 'Failed to load dashboard stats'));
  }
});

router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampPageSize(req.query.pageSize || req.query.limit);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(),
    ]);

    res.json(ok({
      items: users,
      pagination: { page, pageSize: limit, total, hasMore: skip + users.length < total },
    }));
  } catch (err) {
    res.status(500).json(fail('SERVER_ERROR', 'Failed to load users'));
  }
});

router.put('/users/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['athlete', 'parent', 'coach', 'academy_owner', 'admin'].includes(role)) {
      return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid role'));
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json(fail('NOT_FOUND', 'User not found'));
    res.json(ok(user));
  } catch (err) {
    res.status(500).json(fail('SERVER_ERROR', 'Failed to update user role'));
  }
});

// POST /admin/seed/sports — Seed all sports into the database
router.post('/seed/sports', protect, adminOnly, async (req, res) => {
  try {
    const sportsData = require('../seeds/seedSports');
    await Sport.deleteMany({});
    const created = await Sport.insertMany(sportsData);
    res.json(ok({ message: `Seeded ${created.length} sports successfully`, count: created.length }));
  } catch (err) {
    res.status(500).json(fail('SEED_ERROR', 'Failed to seed sports: ' + err.message));
  }
});

// GET /admin/seed/status — Check seed status
router.get('/seed/status', protect, adminOnly, async (req, res) => {
  try {
    const sportCount = await Sport.countDocuments();
    const academyCount = await Academy.countDocuments();
    const coachCount = await Coach.countDocuments();
    res.json(ok({ sports: sportCount, academies: academyCount, coaches: coachCount }));
  } catch (err) {
    res.status(500).json(fail('SERVER_ERROR', 'Failed to check seed status'));
  }
});

module.exports = router;
