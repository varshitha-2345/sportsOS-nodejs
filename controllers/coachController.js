const express = require('express');
const router = express.Router();
const coachRepo = require('../repositories/coachRepository');

// GET all coaches
router.get('/', async (req, res) => {
    try {
        const coaches = await coachRepo.getAllCoaches();
        res.json(coaches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET coaches by academyId
router.get('/academy/:academyId', async (req, res) => {
    try {
        const coaches = await coachRepo.getCoachesByAcademy(req.params.academyId);
        res.json(coaches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET coaches by sport
router.get('/sport/:sport', async (req, res) => {
    try {
        const coaches = await coachRepo.getCoachesBySport(req.params.sport);
        res.json(coaches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET coach by ID
router.get('/:id', async (req, res) => {
    try {
        const coach = await coachRepo.getCoachById(req.params.id);
        if (!coach) return res.status(404).json({ message: 'Coach not found' });
        res.json(coach);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create coach
router.post('/', async (req, res) => {
    try {
        const { name, sport, academyId } = req.body;

        const isDuplicate = await coachRepo.findDuplicate(name, sport, academyId);
        if (isDuplicate) {
            return res.status(409).json({ message: 'Coach already exists!' });
        }

        const coach = await coachRepo.createCoach({ name, sport, academyId });
        res.status(201).json(coach);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE coach
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await coachRepo.deleteCoach(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Coach not found' });
        res.json({ message: 'Deleted coach with id ' + req.params.id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;