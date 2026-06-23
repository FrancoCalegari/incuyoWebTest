/**
 * Admin Routes — Dashboard, CRUD, Authentication
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query, uploadFile, deleteFile } = require('../lib/spider');
const { requireAdmin } = require('../middleware/auth');
const { invalidateDbContextCache, setPreferredModel, getPreferredModel } = require('../lib/chatbot');

const path = require('path');
const upload = multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, '../public/uploads'),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
        }
    }),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});
const fs = require('fs');

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
        const [currResult, scResult, projResult, diplomResult, pasResult, configResult, certResult, testResult, scholarshipsResult] = await Promise.all([
            query('SELECT * FROM curriculum ORDER BY year, order_index'),
            query('SELECT * FROM social_commitment ORDER BY order_index'),
            query('SELECT * FROM student_projects ORDER BY year, order_index'),
            query('SELECT * FROM diplomaturas ORDER BY order_index').catch(() => ({ result: [] })),
            query('SELECT * FROM pasantias_empresas ORDER BY order_index').catch(() => ({ result: [] })),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] })),
            query('SELECT * FROM certificaciones_laborales ORDER BY year, order_index').catch(() => ({ result: [] })),
            query('SELECT * FROM testimonios ORDER BY order_index').catch(() => ({ result: [] })),
            query('SELECT * FROM scholarship_applications ORDER BY created_at DESC').catch(() => ({ result: [] })),
        ]);

        const curriculum = currResult?.result || currResult?.results || (Array.isArray(currResult) ? currResult : []);
        const commitments = scResult?.result || scResult?.results || (Array.isArray(scResult) ? scResult : []);
        const projects = projResult?.result || projResult?.results || (Array.isArray(projResult) ? projResult : []);
        const diplomaturas = diplomResult?.result || diplomResult?.results || (Array.isArray(diplomResult) ? diplomResult : []);
        const pasantias = pasResult?.result || pasResult?.results || (Array.isArray(pasResult) ? pasResult : []);
        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const certificaciones = certResult?.result || certResult?.results || (Array.isArray(certResult) ? certResult : []);
        const testimonios = testResult?.result || testResult?.results || (Array.isArray(testResult) ? testResult : []);
        const scholarships = scholarshipsResult?.result || scholarshipsResult?.results || (Array.isArray(scholarshipsResult) ? scholarshipsResult : []);

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

        res.render('admin/dashboard', { curriculum, commitments, projects, diplomaturas, pasantias, horario, certificaciones, testimonios, scholarships, config });
    } catch (err) {
        console.error('Error load dashboard:', err);
        res.render('admin/dashboard', { curriculum: [], commitments: [], projects: [], diplomaturas: [], pasantias: [], horario: null, certificaciones: [], testimonios: [], scholarships: [], config: {} });
    }
});

// ─── FILE UPLOAD ─────────────────────────────────────
router.post('/api/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
        console.log(`Uploaded local file: ${req.file.originalname}, Size: ${req.file.size}, Path: ${req.file.path}, Type: ${req.file.mimetype}`);
        
        const isVideo = req.file.mimetype.startsWith('video/');

        if (isVideo) {
            // Guardado local
            const localUrl = `/uploads/${req.file.filename}`;
            const result = {
                id: req.file.filename,
                url: localUrl,
                name: req.file.originalname
            };
            return res.json({ success: true, file: result });
        } else {
            // Guardado en Cloud Storage via SpiderWeb API
            const fileBuffer = fs.readFileSync(req.file.path);
            const uploaded = await uploadFile(fileBuffer, req.file.originalname, req.file.mimetype);
            
            // Eliminar el archivo local temporal
            fs.unlinkSync(req.file.path);

            const result = {
                id: uploaded.id,
                url: `/admin/api/img/${uploaded.id}`,
                name: uploaded.name
            };
            return res.json({ success: true, file: result });
        }
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Error al procesar la subida del archivo' });
    }
});

// ─── IMAGE PROXY ──────────────────────────────────────
const fetch = require('node-fetch');
router.get('/api/img/:fileId', async (req, res) => {
    try {
        const API_URL = process.env.SPIDER_API_URL ? process.env.SPIDER_API_URL.replace(/\/+$/, '') : '';
        const API_KEY = process.env.SPIDER_API_KEY;
        const imgRes = await fetch(`${API_URL}/storage/files/${req.params.fileId}`, {
            headers: { 'X-API-KEY': API_KEY }
        });
        if (!imgRes.ok) return res.status(imgRes.status).send('Image not found');
        let contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const contentDisposition = imgRes.headers.get('content-disposition') || '';
        if (contentDisposition.toLowerCase().includes('.mp4')) contentType = 'video/mp4';
        else if (contentDisposition.toLowerCase().includes('.webm')) contentType = 'video/webm';
        
        res.set('Content-Type', contentType);
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
        // Crear tabla de testimonios
        await query(`CREATE TABLE testimonios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_name VARCHAR(255) NOT NULL,
            student_role VARCHAR(255) NOT NULL,
            video_url TEXT,
            order_index INT DEFAULT 0
        )`).catch(() => {});
        // Crear tabla de becas
        await query(`CREATE TABLE IF NOT EXISTS scholarship_applications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(255),
            reason TEXT,
            age INT,
            high_school_finished TINYINT(1),
            preferred_shifts VARCHAR(255),
            status ENUM('pending', 'reviewed') DEFAULT 'pending',
            created_at DATETIME DEFAULT NOW()
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
        invalidateDbContextCache();
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
        invalidateDbContextCache();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/curriculum/all', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM curriculum`);
        invalidateDbContextCache();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/curriculum/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM curriculum WHERE id=${parseInt(req.params.id)}`);
        invalidateDbContextCache();
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
        invalidateDbContextCache();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/certificaciones/:id', requireAdmin, async (req, res) => {
    try {
        const { year, nombre, order_index } = req.body;
        await query(`UPDATE certificaciones_laborales SET year=${parseInt(year)}, nombre=?, order_index=${parseInt(order_index || 0)} WHERE id=${parseInt(req.params.id)}`, [nombre]);
        invalidateDbContextCache();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/certificaciones/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM certificaciones_laborales WHERE id=${parseInt(req.params.id)}`);
        invalidateDbContextCache();
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

// ─── TESTIMONIOS CRUD ────────────────────────────────

router.post('/api/testimonios', requireAdmin, async (req, res) => {
    try {
        const { student_name, student_role, video_url, order_index } = req.body;
        await query(
            `INSERT INTO testimonios (student_name, student_role, video_url, order_index) VALUES (?, ?, ?, ?)`,
            [student_name, student_role, video_url || '', parseInt(order_index || 0)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/testimonios/:id', requireAdmin, async (req, res) => {
    try {
        const { student_name, student_role, video_url, order_index } = req.body;
        await query(
            `UPDATE testimonios SET student_name=?, student_role=?, video_url=?, order_index=? WHERE id=?`,
            [student_name, student_role, video_url || '', parseInt(order_index || 0), parseInt(req.params.id)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/testimonios/:id/delete', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM testimonios WHERE id=?`, [parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── BECAS (SCHOLARSHIPS) CRUD ────────────────────────
router.get('/api/scholarships', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM scholarship_applications ORDER BY created_at DESC');
        res.json(result?.result || result?.results || (Array.isArray(result) ? result : []));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/scholarships/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM scholarship_applications WHERE id=?`, [parseInt(req.params.id)]);
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
        invalidateDbContextCache();
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
        invalidateDbContextCache();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/diplomaturas/:id', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM diplomaturas WHERE id=${parseInt(req.params.id)}`);
        invalidateDbContextCache();
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

router.post('/api/configuracion/bulk', requireAdmin, async (req, res) => {
    try {
        const data = req.body;
        if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Datos inválidos' });
        
        for (const [clave, valor] of Object.entries(data)) {
            // Guardar o actualizar
            await query(`INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor=?`, [clave, valor, valor]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error in bulk config:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── SPIDERIA STATUS ─────────────────────────────────
router.get('/api/spideria-status', requireAdmin, async (req, res) => {
    const SPIDER_IA_URL = process.env.SPIDER_API_URL ? process.env.SPIDER_API_URL.replace(/\/+$/, '') : '';
    const API_KEY = process.env.SPIDER_API_KEY;
    try {
        const [modelsRes, usageRes] = await Promise.all([
            fetch(`${SPIDER_IA_URL}/ia/models`, {
                headers: { 'X-API-KEY': API_KEY },
                signal: AbortSignal.timeout(6000),
            }),
            fetch(`${SPIDER_IA_URL}/ia/usage`, {
                headers: { 'X-API-KEY': API_KEY },
                signal: AbortSignal.timeout(6000),
            }).catch(() => null),
        ]);

        if (!modelsRes.ok) {
            return res.json({ ok: false, error: `HTTP ${modelsRes.status}`, models: [], usage: null, url: SPIDER_IA_URL });
        }

        const modelsData = await modelsRes.json();
        const models = modelsData.models || modelsData || [];

        let usage = null;
        if (usageRes && usageRes.ok) {
            usage = await usageRes.json();
        }

        res.json({ ok: true, models, usage, url: SPIDER_IA_URL });
    } catch (err) {
        res.json({ ok: false, error: err.message, models: [], usage: null, url: SPIDER_IA_URL });
    }
});

// ─── SPIDERIA TEST ───────────────────────────────────
router.post('/api/spideria-test', requireAdmin, async (req, res) => {
    const SPIDER_IA_URL = process.env.SPIDER_API_URL ? process.env.SPIDER_API_URL.replace(/\/+$/, '') : '';
    const API_KEY = process.env.SPIDER_API_KEY;
    const { prompt = 'Hola, ¿cómo estás?' } = req.body;

    const t0 = Date.now();
    const result = { ok: false, url: SPIDER_IA_URL, prompt, modelId: null, elapsed_ms: null, response: null, rawJson: null, error: null, httpStatus: null };

    try {
        // 1. Obtener modelos
        const modelsRes = await fetch(`${SPIDER_IA_URL}/ia/models`, {
            headers: { 'X-API-KEY': API_KEY },
            signal: AbortSignal.timeout(6000),
        });
        result.httpStatus = modelsRes.status;
        if (!modelsRes.ok) {
            const body = await modelsRes.text().catch(() => '');
            result.error = `GET /ia/models → HTTP ${modelsRes.status}: ${body}`;
            result.elapsed_ms = Date.now() - t0;
            return res.json(result);
        }

        const modelsData = await modelsRes.json();
        const models = modelsData.models || modelsData || [];
        if (!models.length) {
            result.error = 'GET /ia/models → OK pero sin modelos disponibles';
            result.elapsed_ms = Date.now() - t0;
            return res.json(result);
        }
        result.modelId = models[0].id;

        // 2. Enviar mensaje de prueba
        const chatRes = await fetch(`${SPIDER_IA_URL}/ia/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
            body: JSON.stringify({
                model_id: result.modelId,
                messages: [
                    { role: 'system', content: 'Eres un asistente útil. Responde de forma breve.' },
                    { role: 'user', content: prompt },
                ],
            }),
            signal: AbortSignal.timeout(15000),
        });
        result.httpStatus = chatRes.status;

        const rawBody = await chatRes.text();
        let parsedJson = null;
        try { parsedJson = JSON.parse(rawBody); } catch (_) { /* not JSON */ }
        result.rawJson = parsedJson || rawBody;

        if (!chatRes.ok) {
            result.error = `POST /ia/chat → HTTP ${chatRes.status}: ${rawBody}`;
            result.elapsed_ms = Date.now() - t0;
            return res.json(result);
        }

        const text = parsedJson?.message?.content || parsedJson?.choices?.[0]?.message?.content;
        if (!text) {
            result.error = 'POST /ia/chat → HTTP 200 pero sin contenido en la respuesta';
            result.elapsed_ms = Date.now() - t0;
            return res.json(result);
        }

        result.ok = true;
        result.response = text;
        result.elapsed_ms = Date.now() - t0;
        res.json(result);

    } catch (err) {
        result.error = err.message;
        result.elapsed_ms = Date.now() - t0;
        res.json(result);
    }
});

// ─── MODELO IA SELECCIONADO ───────────────────────────────────────

/** Al arrancar el servidor, carga el modelo guardado en la DB */
(async () => {
    try {
        const result = await query("SELECT valor FROM configuracion WHERE clave='spideria_model_id'");
        const rows = result?.result || result?.results || (Array.isArray(result) ? result : []);
        if (rows[0]?.valor) {
            const savedId = parseInt(rows[0].valor, 10);
            if (!isNaN(savedId)) {
                setPreferredModel(savedId);
                console.log(`🔧 [Admin] Modelo SpiderIA restaurado desde DB: ${savedId}`);
            }
        }
    } catch (_) { /* ignorar si la tabla no existe aún */ }
})();

/** GET /admin/api/spideria-selected-model — modelo activo actual */
router.get('/api/spideria-selected-model', requireAdmin, (req, res) => {
    res.json({ model_id: getPreferredModel() });
});

/** POST /admin/api/spideria-selected-model — cambia el modelo activo */
router.post('/api/spideria-selected-model', requireAdmin, async (req, res) => {
    const { model_id } = req.body;
    const modelId = model_id !== null && model_id !== undefined ? parseInt(model_id, 10) : null;

    if (model_id !== null && isNaN(modelId)) {
        return res.status(400).json({ error: 'model_id debe ser un número entero o null (auto)' });
    }

    // Aplicar en memoria de inmediato
    setPreferredModel(modelId);

    // Persistir en la DB para sobrevivir reinicios del servidor
    try {
        if (modelId !== null) {
            await query(
                `INSERT INTO configuracion (clave, valor) VALUES ('spideria_model_id', ?) ON DUPLICATE KEY UPDATE valor=?`,
                [String(modelId), String(modelId)]
            );
        } else {
            // null = auto: borrar preferencia guardada
            await query(`DELETE FROM configuracion WHERE clave='spideria_model_id'`).catch(() => {});
        }
    } catch (err) {
        console.warn('[Admin] No se pudo persistir model_id en DB:', err.message);
        // No es fatal, el cambio en memoria ya fue aplicado
    }

    console.log(`✅ [Admin] Modelo SpiderIA cambiado a: ${modelId ?? 'auto'}`);
    res.json({ success: true, model_id: modelId });
});

// ─── LIVE CHAT — Admin endpoints ─────────────────────────────────────────────

/** POST /admin/api/init-chat-tables — crea las tablas de live chat en la DB */
router.post('/api/init-chat-tables', requireAdmin, async (req, res) => {
    try {
        await query(`CREATE TABLE IF NOT EXISTS chat_sessions (
            id VARCHAR(36) PRIMARY KEY,
            session_key VARCHAR(64) UNIQUE NOT NULL,
            status ENUM('waiting','active','closed') DEFAULT 'waiting',
            admin_name VARCHAR(100) DEFAULT NULL,
            created_at DATETIME DEFAULT NOW(),
            expires_at DATETIME NOT NULL
        )`);
        await query(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id VARCHAR(36) NOT NULL,
            role ENUM('user','bot','admin') NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT NOW(),
            INDEX idx_session (session_id),
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )`);
        res.json({ success: true, message: 'Tablas de live chat creadas' });
    } catch (err) {
        // Ignorar si ya existen
        if (err.message && err.message.includes('already exists')) {
            return res.json({ success: true, message: 'Tablas ya existían' });
        }
        res.status(500).json({ error: err.message });
    }
});

/** GET /admin/api/chat-sessions — lista sesiones activas (no expiradas, no cerradas) */
router.get('/api/chat-sessions', requireAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, session_key, status, admin_name, created_at, expires_at,
             (SELECT COUNT(*) FROM chat_messages WHERE session_id=chat_sessions.id) as msg_count
             FROM chat_sessions
             WHERE expires_at > NOW()
             ORDER BY FIELD(status,'waiting','active','closed'), created_at DESC
             LIMIT 50`
        );
        const rows = result?.result || result?.results || (Array.isArray(result) ? result : []);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /admin/api/chat-sessions/:id/messages — mensajes de una sesión */
router.get('/api/chat-sessions/:id/messages', requireAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, role, content, created_at FROM chat_messages WHERE session_id=? ORDER BY id ASC`,
            [req.params.id]
        );
        const messages = result?.result || result?.results || (Array.isArray(result) ? result : []);

        const sessResult = await query(`SELECT * FROM chat_sessions WHERE id=?`, [req.params.id]);
        const sessRows = sessResult?.result || sessResult?.results || (Array.isArray(sessResult) ? sessResult : []);

        res.json({ messages, session: sessRows[0] || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /admin/api/chat-sessions/:id/take-control — admin toma el control */
router.post('/api/chat-sessions/:id/take-control', requireAdmin, async (req, res) => {
    try {
        const adminName = process.env.ADMIN_USER || 'Admin';
        await query(
            `UPDATE chat_sessions SET status='active', admin_name=? WHERE id=?`,
            [adminName, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /admin/api/chat-sessions/:id/send — admin envía mensaje */
router.post('/api/chat-sessions/:id/send', requireAdmin, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ error: 'content requerido' });

        // Asegurar que la sesión está activa
        await query(`UPDATE chat_sessions SET status='active' WHERE id=? AND status='waiting'`, [req.params.id]);

        await query(
            `INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, 'admin', ?, NOW())`,
            [req.params.id, content.substring(0, 4000)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /admin/api/chat-sessions/:id/close — admin cierra la sesión */
router.post('/api/chat-sessions/:id/close', requireAdmin, async (req, res) => {
    try {
        await query(`UPDATE chat_sessions SET status='closed' WHERE id=?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /admin/api/chat-sessions/:id/delete — admin elimina la sesión y sus mensajes */
router.post('/api/chat-sessions/:id/delete', requireAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM chat_sessions WHERE id=?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


