const express = require('express');
const router = express.Router();
const shortlistRepo = require('../repositories/shortlistRepository');

// GET all shortlist
router.get('/', async (req, res) => {
    try {
        const shortlist = await shortlistRepo.getAllShortlist();
        res.json(shortlist);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET shortlist by athleteId
router.get('/athlete/:athleteId', async (req, res) => {
    try {
        const shortlist = await shortlistRepo.getShortlistByAthlete(req.params.athleteId);
        res.json(shortlist);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET shortlist item by ID
router.get('/:id', async (req, res) => {
    try {
        const item = await shortlistRepo.getShortlistById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Shortlist item not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST add to shortlist
router.post('/', async (req, res) => {
    try {
        const { athleteId, academyId } = req.body;

        const isDuplicate = await shortlistRepo.findDuplicate(athleteId, academyId);
        if (isDuplicate) {
            return res.status(409).json({ message: 'Academy already in shortlist!' });
        }

        const item = await shortlistRepo.createShortlist({ athleteId, academyId });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE shortlist item
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await shortlistRepo.deleteShortlist(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Shortlist item not found' });
        res.json({ message: 'Removed from shortlist with id ' + req.params.id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;