const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const Academy = require('../models/Academy');
const Coach = require('../models/Coach');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');

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

    res.json({
      ok: true,
      data: {
        totalAcademies,
        totalCoaches,
        totalUsers,
        pendingVerifications,
        totalEnquiries,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to load dashboard stats' });
  }
});

router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(),
    ]);

    res.json({
      ok: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to load users' });
  }
});

router.put('/users/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['athlete', 'parent', 'coach', 'academy_owner', 'admin'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, data: user });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to update user role' });
  }
});

module.exports = router;
