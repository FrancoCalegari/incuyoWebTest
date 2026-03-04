/**
 * Admin Routes — Dashboard, CRUD, Authentication
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query, uploadFile, deleteFile } = require('../lib/spider');
const { requireAdmin } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── AUTH ────────────────────────────────────────────
router.get('/login', (req, res) => {
    if (req.session?.isAdmin) return res.redirect('/admin');
    res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.render('admin/login', { error: 'Credenciales incorrectas' });
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// ─── DASHBOARD ───────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
    try {
        const [currResult, scResult, projResult] = await Promise.all([
            query('SELECT * FROM curriculum ORDER BY year, order_index'),
            query('SELECT * FROM social_commitment ORDER BY order_index'),
            query('SELECT * FROM student_projects ORDER BY year, order_index'),
        ]);

        const curriculum = currResult?.result || currResult?.results || (Array.isArray(currResult) ? currResult : []);
        const commitments = scResult?.result || scResult?.results || (Array.isArray(scResult) ? scResult : []);
        const projects = projResult?.result || projResult?.results || (Array.isArray(projResult) ? projResult : []);

        // Parse tech_tags
        projects.forEach((p) => {
            try { p.tech_tags_arr = JSON.parse(p.tech_tags || '[]'); } catch (e) { p.tech_tags_arr = []; }
        });

        res.render('admin/dashboard', { curriculum, commitments, projects });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.render('admin/dashboard', { curriculum: [], commitments: [], projects: [] });
    }
});

// ─── FILE UPLOAD ─────────────────────────────────────
router.post('/api/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
        const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
        // Return a proxy URL so the browser loads images through our server
        // (avoids Cross-Origin-Resource-Policy: same-origin block from Spider)
        result.url = `/admin/api/img/${result.id}`;
        res.json({ success: true, file: result });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Error al subir archivo' });
    }
});

// ─── IMAGE PROXY ──────────────────────────────────────
// Serves Spider Storage images through the local server to bypass CORP headers
const fetch = require('node-fetch');
router.get('/api/img/:fileId', async (req, res) => {
    try {
        const API_URL = process.env.SPIDER_API_URL;
        const API_KEY = process.env.SPIDER_API_KEY;
        const imgRes = await fetch(`${API_URL}/storage/files/${req.params.fileId}`, {
            headers: { 'X-API-KEY': API_KEY }
        });
        if (!imgRes.ok) return res.status(imgRes.status).send('Image not found');
        res.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        imgRes.body.pipe(res);
    } catch (err) {
        res.status(500).send('Error loading image');
    }
});

// ─── CURRICULUM CRUD ─────────────────────────────────
router.get('/api/curriculum', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM curriculum ORDER BY year, order_index');
        res.json(result?.result || result?.results || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/curriculum', requireAdmin, async (req, res) => {
    try {
        const { year, subject_name, order_index } = req.body;
        await query(`INSERT INTO curriculum (year, subject_name, order_index) VALUES (${parseInt(year)}, ?, ${parseInt(order_index || 0)})`, [subject_name]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/curriculum/:id', requireAdmin, async (req, res) => {
    try {
        const { year, subject_name, order_index } = req.body;
        await query(`UPDATE curriculum SET year=${parseInt(year)}, subject_name=?, order_index=${parseInt(order_index || 0)} WHERE id=${parseInt(req.params.id)}`, [subject_name]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/curriculum/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM curriculum WHERE id=${parseInt(req.params.id)}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── SOCIAL COMMITMENT CRUD ─────────────────────────
router.get('/api/commitment', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM social_commitment ORDER BY order_index');
        res.json(result?.result || result?.results || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/commitment', requireAdmin, async (req, res) => {
    try {
        const { title, description, image_url, order_index } = req.body;
        await query(`INSERT INTO social_commitment (title, description, image_url, order_index) VALUES (?, ?, ?, ${parseInt(order_index || 0)})`, [title, description, image_url]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/commitment/:id', requireAdmin, async (req, res) => {
    try {
        const { title, description, image_url, order_index } = req.body;
        await query(`UPDATE social_commitment SET title=?, description=?, image_url=?, order_index=${parseInt(order_index || 0)} WHERE id=${parseInt(req.params.id)}`, [title, description, image_url]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/commitment/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM social_commitment WHERE id=${parseInt(req.params.id)}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── STUDENT PROJECTS CRUD ──────────────────────────
router.get('/api/projects', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM student_projects ORDER BY year, order_index');
        const rows = result?.result || result?.results || (Array.isArray(result) ? result : []);
        rows.forEach((p) => {
            try { p.tech_tags_arr = JSON.parse(p.tech_tags || '[]'); } catch (e) { p.tech_tags_arr = []; }
        });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/projects', requireAdmin, async (req, res) => {
    try {
        const { student_name, student_photo_url, year, project_name, project_icon, project_description, project_image_url, project_demo_url, tech_tags, order_index } = req.body;
        const tagsStr = typeof tech_tags === 'string' ? tech_tags : JSON.stringify(tech_tags || []);
        await query(
            `INSERT INTO student_projects (student_name, student_photo_url, year, project_name, project_icon, project_description, project_image_url, project_demo_url, tech_tags, order_index) VALUES (?, ?, ${parseInt(year)}, ?, ?, ?, ?, ?, ?, ${parseInt(order_index || 0)})`,
            [student_name, student_photo_url || '', project_name, project_icon || 'fas fa-code', project_description, project_image_url || '', project_demo_url || '', tagsStr]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/projects/:id', requireAdmin, async (req, res) => {
    try {
        const { student_name, student_photo_url, year, project_name, project_icon, project_description, project_image_url, project_demo_url, tech_tags, order_index } = req.body;
        const tagsStr = typeof tech_tags === 'string' ? tech_tags : JSON.stringify(tech_tags || []);
        await query(
            `UPDATE student_projects SET student_name=?, student_photo_url=?, year=${parseInt(year)}, project_name=?, project_icon=?, project_description=?, project_image_url=?, project_demo_url=?, tech_tags=?, order_index=${parseInt(order_index || 0)} WHERE id=${parseInt(req.params.id)}`,
            [student_name, student_photo_url || '', project_name, project_icon || 'fas fa-code', project_description, project_image_url || '', project_demo_url || '', tagsStr]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/projects/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM student_projects WHERE id=${parseInt(req.params.id)}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
