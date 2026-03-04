/**
 * Public Routes — Landing page & Student Projects
 */
const express = require('express');
const router = express.Router();
const { query } = require('../lib/spider');

// GET / — Landing page
router.get('/', async (req, res) => {
    try {
        // Fetch curriculum grouped by year
        const currResult = await query('SELECT * FROM curriculum ORDER BY year, order_index');
        const currRows = currResult?.result || currResult?.results || (Array.isArray(currResult) ? currResult : []);

        const curriculum = { 1: [], 2: [], 3: [] };
        currRows.forEach((row) => {
            if (curriculum[row.year]) curriculum[row.year].push(row);
        });

        // Fetch social commitment
        const scResult = await query('SELECT * FROM social_commitment ORDER BY order_index');
        const commitments = scResult?.result || scResult?.results || (Array.isArray(scResult) ? scResult : []);

        res.render('index', { curriculum, commitments });
    } catch (err) {
        console.error('Error loading landing page:', err);
        // Render with fallback empty data
        res.render('index', { curriculum: { 1: [], 2: [], 3: [] }, commitments: [] });
    }
});

// GET /proyectosalumnos — Student Projects
router.get('/proyectosalumnos', async (req, res) => {
    try {
        const projResult = await query('SELECT * FROM student_projects ORDER BY year, order_index');
        const projRows = projResult?.result || projResult?.results || (Array.isArray(projResult) ? projResult : []);

        const projects = { 1: [], 2: [], 3: [] };
        projRows.forEach((row) => {
            row.tech_tags_arr = [];
            try {
                row.tech_tags_arr = JSON.parse(row.tech_tags || '[]');
            } catch (e) { }
            if (projects[row.year]) projects[row.year].push(row);
        });

        res.render('proyectos', { projects });
    } catch (err) {
        console.error('Error loading projects:', err);
        res.render('proyectos', { projects: { 1: [], 2: [], 3: [] } });
    }
});

module.exports = router;
