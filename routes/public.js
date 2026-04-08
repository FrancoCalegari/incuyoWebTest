/**
 * Public Routes — Landing page, Diplomaturas & Student Projects
 */
const express = require('express');
const router = express.Router();
const { query } = require('../lib/spider');

// ─── Helper: normalizar imagen URLs ─────────────────
function normalizeImgUrl(url) {
    if (!url) return '';
    if (url.includes('/api/v1/storage/files/')) {
        const fileId = url.split('/api/v1/storage/files/')[1].split('?')[0];
        return `/api/storage/files/${fileId}`;
    }
    return url;
}

// GET / — Landing page
router.get('/', async (req, res) => {
    try {
        const [currResult, scResult, diplomResult, pasResult, configResult] = await Promise.all([
            query('SELECT * FROM curriculum ORDER BY year, order_index'),
            query('SELECT * FROM social_commitment ORDER BY order_index'),
            query('SELECT * FROM diplomaturas WHERE destacado=1 ORDER BY order_index LIMIT 5').catch(() => ({ result: [] })),
            query('SELECT * FROM pasantias_empresas ORDER BY order_index').catch(() => ({ result: [] })),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] })),
        ]);

        const currRows = currResult?.result || currResult?.results || (Array.isArray(currResult) ? currResult : []);
        const curriculum = { 1: [], 2: [], 3: [] };
        currRows.forEach((row) => {
            if (curriculum[row.year]) curriculum[row.year].push(row);
        });

        const commitments = scResult?.result || scResult?.results || (Array.isArray(scResult) ? scResult : []);

        const diplomRows = diplomResult?.result || diplomResult?.results || (Array.isArray(diplomResult) ? diplomResult : []);
        diplomRows.forEach(d => { d.imagen_url = normalizeImgUrl(d.imagen_url); });

        const pasRows = pasResult?.result || pasResult?.results || (Array.isArray(pasResult) ? pasResult : []);
        pasRows.forEach(p => { p.logo_url = normalizeImgUrl(p.logo_url); });

        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const configMap = {};
        configRows.forEach(r => { configMap[r.clave] = r.valor; });

        let horario = null;
        try { horario = JSON.parse(configMap.horario || 'null'); } catch (e) { horario = null; }

        res.render('index', { curriculum, commitments, diplomaturas: diplomRows, pasantias: pasRows, horario });
    } catch (err) {
        console.error('Error loading landing page:', err);
        res.render('index', {
            curriculum: { 1: [], 2: [], 3: [] },
            commitments: [],
            diplomaturas: [],
            pasantias: [],
            horario: null,
        });
    }
});

// GET /diplomaturas — Página completa de diplomaturas
router.get('/diplomaturas', async (req, res) => {
    try {
        const result = await query('SELECT * FROM diplomaturas ORDER BY order_index');
        const diplomaturas = result?.result || result?.results || (Array.isArray(result) ? result : []);
        diplomaturas.forEach(d => { d.imagen_url = normalizeImgUrl(d.imagen_url); });
        res.render('diplomaturas', { diplomaturas });
    } catch (err) {
        console.error('Error loading diplomaturas:', err);
        res.render('diplomaturas', { diplomaturas: [] });
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

// GET /servicios — Servicios tecnológicos integrales INCUYO
router.get('/servicios', (req, res) => {
    res.render('Servicios');
});

// Proxy for Cloud Storage Images to bypass CORS and hide API KEY
router.get('/api/storage/files/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        const spiderUrl = `${process.env.SPIDER_API_URL}/api/v1/storage/files/${fileId}`;
        const response = await fetch(spiderUrl, {
            method: 'GET',
            headers: { 'X-API-KEY': process.env.SPIDER_API_KEY }
        });

        if (!response.ok) {
            return res.status(response.status).send('Error fetching image');
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        response.body.pipe(res);
    } catch (err) {
        console.error('Error proxying image:', err);
        res.status(500).send('Internal Server Error proxying image');
    }
});

module.exports = router;
