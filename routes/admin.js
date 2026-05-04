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
        const [currResult, scResult, projResult, diplomResult, pasResult, configResult, certResult] = await Promise.all([
            query('SELECT * FROM curriculum ORDER BY year, order_index'),
            query('SELECT * FROM social_commitment ORDER BY order_index'),
            query('SELECT * FROM student_projects ORDER BY year, order_index'),
            query('SELECT * FROM diplomaturas ORDER BY order_index').catch(() => ({ result: [] })),
            query('SELECT * FROM pasantias_empresas ORDER BY order_index').catch(() => ({ result: [] })),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] })),
            query('SELECT * FROM certificaciones_laborales ORDER BY year, order_index').catch(() => ({ result: [] })),
        ]);

        const curriculum = currResult?.result || currResult?.results || (Array.isArray(currResult) ? currResult : []);
        const commitments = scResult?.result || scResult?.results || (Array.isArray(scResult) ? scResult : []);
        const projects = projResult?.result || projResult?.results || (Array.isArray(projResult) ? projResult : []);
        const diplomaturas = diplomResult?.result || diplomResult?.results || (Array.isArray(diplomResult) ? diplomResult : []);
        const pasantias = pasResult?.result || pasResult?.results || (Array.isArray(pasResult) ? pasResult : []);
        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const certificaciones = certResult?.result || certResult?.results || (Array.isArray(certResult) ? certResult : []);

        // Parse tech_tags
        projects.forEach((p) => {
            try { p.tech_tags_arr = JSON.parse(p.tech_tags || '[]'); } catch (e) { p.tech_tags_arr = []; }
        });

        // Build config map
        const config = {};
        configRows.forEach(r => { config[r.clave] = r.valor; });

        // Parse horario JSON
        let horario = null;
        try { horario = JSON.parse(config.horario || 'null'); } catch (e) { horario = null; }

        res.render('admin/dashboard', { curriculum, commitments, projects, diplomaturas, pasantias, horario, certificaciones });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.render('admin/dashboard', { curriculum: [], commitments: [], projects: [], diplomaturas: [], pasantias: [], horario: null, certificaciones: [] });
    }
});

// ─── FILE UPLOAD ─────────────────────────────────────
router.post('/api/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
        const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
        result.url = `/admin/api/img/${result.id}`;
        res.json({ success: true, file: result });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Error al subir archivo' });
    }
});

// ─── IMAGE PROXY ──────────────────────────────────────
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

// ─── INIT TABLES ─────────────────────────────────────
router.post('/api/init-tables', requireAdmin, async (req, res) => {
    try {
        await query(`CREATE TABLE IF NOT EXISTS diplomaturas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            descripcion_breve TEXT,
            descripcion_completa TEXT,
            imagen_url TEXT,
            fecha_inicio VARCHAR(100),
            whatsapp_msg TEXT,
            order_index INT DEFAULT 0,
            destacado TINYINT(1) DEFAULT 0
        )`);
        await query(`CREATE TABLE IF NOT EXISTS pasantias_empresas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            logo_url TEXT,
            order_index INT DEFAULT 0
        )`);
        await query(`CREATE TABLE IF NOT EXISTS configuracion (
            clave VARCHAR(100) PRIMARY KEY,
            valor TEXT
        )`);
        // Agregar columna semestre a curriculum (ignora error si ya existe)
        await query(`ALTER TABLE curriculum ADD COLUMN semestre VARCHAR(20) NULL DEFAULT NULL`).catch(() => {});
        // Crear tabla de certificaciones laborales (ignora error si ya existe)
        await query(`CREATE TABLE certificaciones_laborales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            year INT NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            order_index INT DEFAULT 0
        )`).catch(() => {});
        // Insert default horario if not exists
        await query(`INSERT IGNORE INTO configuracion (clave, valor) VALUES ('horario', '${JSON.stringify([
            { dia: 'Lunes', abierto: true, apertura: '08:00', cierre: '20:00' },
            { dia: 'Martes', abierto: true, apertura: '08:00', cierre: '20:00' },
            { dia: 'Miércoles', abierto: true, apertura: '08:00', cierre: '20:00' },
            { dia: 'Jueves', abierto: true, apertura: '08:00', cierre: '20:00' },
            { dia: 'Viernes', abierto: true, apertura: '08:00', cierre: '20:00' },
            { dia: 'Sábado', abierto: true, apertura: '09:00', cierre: '13:00' },
            { dia: 'Domingo', abierto: false, apertura: '', cierre: '' },
        ]).replace(/'/g, "''")}' )`);
        res.json({ success: true, message: 'Tablas creadas correctamente' });
    } catch (err) {
        console.error('Init tables error:', err);
        res.status(500).json({ error: err.message });
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
        const { year, subject_name, order_index, semestre } = req.body;
        const sem = semestre || null;
        await query(`INSERT INTO curriculum (year, subject_name, order_index, semestre) VALUES (${parseInt(year)}, ?, ${parseInt(order_index || 0)}, ?)`, [subject_name, sem]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/curriculum/:id', requireAdmin, async (req, res) => {
    try {
        const { year, subject_name, order_index, semestre } = req.body;
        const sem = semestre || null;
        await query(`UPDATE curriculum SET year=${parseInt(year)}, subject_name=?, order_index=${parseInt(order_index || 0)}, semestre=? WHERE id=${parseInt(req.params.id)}`, [subject_name, sem]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/curriculum/all', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM curriculum`);
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

// ─── CERTIFICACIONES LABORALES CRUD ──────────────────
router.get('/api/certificaciones', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM certificaciones_laborales ORDER BY year, order_index');
        res.json(result?.result || result?.results || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/certificaciones', requireAdmin, async (req, res) => {
    try {
        const { year, nombre, order_index } = req.body;
        const yr = parseInt(year);
        // Validar límite de 10 por año
        const countResult = await query(`SELECT COUNT(*) as total FROM certificaciones_laborales WHERE year=${yr}`);
        const total = countResult?.result?.[0]?.total || countResult?.results?.[0]?.total || 0;
        if (total >= 10) return res.status(400).json({ error: `Límite de 10 certificaciones por año alcanzado para el año ${yr}` });
        await query(`INSERT INTO certificaciones_laborales (year, nombre, order_index) VALUES (${yr}, ?, ${parseInt(order_index || 0)})`, [nombre]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/certificaciones/:id', requireAdmin, async (req, res) => {
    try {
        const { year, nombre, order_index } = req.body;
        await query(`UPDATE certificaciones_laborales SET year=${parseInt(year)}, nombre=?, order_index=${parseInt(order_index || 0)} WHERE id=${parseInt(req.params.id)}`, [nombre]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/certificaciones/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM certificaciones_laborales WHERE id=${parseInt(req.params.id)}`);
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

router.delete('/api/commitment/all', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM social_commitment`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}); router.delete('/api/commitment/:id', requireAdmin, async (req, res) => {
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

// ─── DIPLOMATURAS CRUD ───────────────────────────────
router.get('/api/diplomaturas', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM diplomaturas ORDER BY order_index');
        res.json(result?.result || result?.results || (Array.isArray(result) ? result : []));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/diplomaturas', requireAdmin, async (req, res) => {
    try {
        const { nombre, descripcion_breve, descripcion_completa, imagen_url, fecha_inicio, whatsapp_msg, order_index, destacado } = req.body;
        await query(
            `INSERT INTO diplomaturas (nombre, descripcion_breve, descripcion_completa, imagen_url, fecha_inicio, whatsapp_msg, order_index, destacado) VALUES (?, ?, ?, ?, ?, ?, ${parseInt(order_index || 0)}, ${destacado ? 1 : 0})`,
            [nombre, descripcion_breve || '', descripcion_completa || '', imagen_url || '', fecha_inicio || '', whatsapp_msg || '']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/diplomaturas/:id', requireAdmin, async (req, res) => {
    try {
        const { nombre, descripcion_breve, descripcion_completa, imagen_url, fecha_inicio, whatsapp_msg, order_index, destacado } = req.body;
        await query(
            `UPDATE diplomaturas SET nombre=?, descripcion_breve=?, descripcion_completa=?, imagen_url=?, fecha_inicio=?, whatsapp_msg=?, order_index=${parseInt(order_index || 0)}, destacado=${destacado ? 1 : 0} WHERE id=${parseInt(req.params.id)}`,
            [nombre, descripcion_breve || '', descripcion_completa || '', imagen_url || '', fecha_inicio || '', whatsapp_msg || '']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/diplomaturas/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM diplomaturas WHERE id=${parseInt(req.params.id)}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PASANTÍAS EMPRESAS CRUD ─────────────────────────
router.get('/api/pasantias', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM pasantias_empresas ORDER BY order_index');
        res.json(result?.result || result?.results || (Array.isArray(result) ? result : []));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/pasantias', requireAdmin, async (req, res) => {
    try {
        const { nombre, logo_url, order_index } = req.body;
        await query(
            `INSERT INTO pasantias_empresas (nombre, logo_url, order_index) VALUES (?, ?, ${parseInt(order_index || 0)})`,
            [nombre, logo_url || '']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/pasantias/:id', requireAdmin, async (req, res) => {
    try {
        const { nombre, logo_url, order_index } = req.body;
        await query(
            `UPDATE pasantias_empresas SET nombre=?, logo_url=?, order_index=${parseInt(order_index || 0)} WHERE id=${parseInt(req.params.id)}`,
            [nombre, logo_url || '']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/pasantias/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM pasantias_empresas WHERE id=${parseInt(req.params.id)}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CONFIGURACIÓN (HORARIO) ─────────────────────────
router.get('/api/configuracion', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM configuracion');
        const rows = result?.result || result?.results || (Array.isArray(result) ? result : []);
        const config = {};
        rows.forEach(r => { config[r.clave] = r.valor; });
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/configuracion', requireAdmin, async (req, res) => {
    try {
        const { horario } = req.body;
        const horarioStr = typeof horario === 'string' ? horario : JSON.stringify(horario);
        await query(`INSERT INTO configuracion (clave, valor) VALUES ('horario', ?) ON DUPLICATE KEY UPDATE valor=?`, [horarioStr, horarioStr]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
