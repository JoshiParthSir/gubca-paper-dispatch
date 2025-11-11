const express = require('express');
const router = express.Router();
const { College } = require('../models');

// POST a new college
router.post('/', async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name || !code) return res.status(400).json({ error: 'name and code required' });
        const college = await College.create({ name, code, ...req.body });
        return res.status(201).json(college);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError' || err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'College already exists' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

module.exports = router;