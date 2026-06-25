/**
 * Public Routes — Landing page, Diplomaturas & Student Projects
 */
const express = require('express');
const router = express.Router();
const { query } = require('../lib/spider');
const { randomUUID: uuidv4 } = require('crypto');
const nodemailer = require('nodemailer');

// ─── Email transporter ───────────────────────────────
function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

async function sendAdminNotificationEmail(sessionId, chatHistory) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    if (!adminEmails.length) {
        console.warn('⚠️ [LiveChat] No hay ADMIN_EMAILS configurados en .env');
        return;
    }
    if (!process.env.SMTP_USER || process.env.SMTP_PASS === 'xxxx xxxx xxxx xxxx') {
        console.warn('⚠️ [LiveChat] SMTP no configurado — email no enviado. Configurar SMTP_USER y SMTP_PASS en .env');
        return;
    }

    const historyHtml = (chatHistory || [])
        .map(m => `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:6px 12px;color:${m.role === 'user' ? '#1a56db' : '#059669'};font-weight:600;white-space:nowrap;">${m.role === 'user' ? '👤 Visitante' : '🤖 Asistente IA'}</td>
            <td style="padding:6px 12px;">${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>`).join('');

    const dashboardUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/admin`;

    const transporter = createTransporter();
    try {
        await transporter.sendMail({
            from: `"INCUYO Web" <${process.env.SMTP_USER}>`,
            to: adminEmails.join(', '),
            subject: '🚨 Un visitante solicita asistencia humana en el chat',
            html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;color:white;">
                    <h2 style="margin:0;font-size:1.3rem;">🙋 Solicitud de Asistencia Humana</h2>
                    <p style="margin:8px 0 0;opacity:0.85;">Instituto INCUYO — Chat en Vivo</p>
                </div>
                <div style="padding:24px;">
                    <p style="margin-top:0;">Un visitante del sitio web solicitó charlar con una persona real. A continuación el historial de conversación con el asistente IA:</p>
                    ${historyHtml ? `<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">${historyHtml}</table>` : '<p style="color:#888;">Sin historial previo.</p>'}
                    <div style="margin-top:24px;text-align:center;">
                        <a href="${dashboardUrl}" style="background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                            🖥️ Ir al Dashboard Admin
                        </a>
                    </div>
                    <p style="font-size:0.8rem;color:#888;margin-top:20px;">ID de sesión: ${sessionId} · Válida por 48 horas</p>
                </div>
            </div>`,
        });
        console.log(`✉️ [LiveChat] Email enviado a: ${adminEmails.join(', ')}`);
    } catch (err) {
        console.error('❌ [LiveChat] Error enviando email:', err.message);
    }
}

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
        const [currResult, scResult, diplomResult, pasResult, configResult, certResult] = await Promise.all([
            query('SELECT * FROM curriculum ORDER BY year, order_index'),
            query('SELECT * FROM social_commitment ORDER BY order_index'),
            query('SELECT * FROM diplomaturas WHERE destacado=1 ORDER BY order_index LIMIT 6').catch(() => ({ result: [] })),
            query('SELECT * FROM pasantias_empresas ORDER BY order_index').catch(() => ({ result: [] })),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] })),
            query('SELECT * FROM certificaciones_laborales ORDER BY year, order_index').catch(() => ({ result: [] })),
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

        const certRows = certResult?.result || certResult?.results || (Array.isArray(certResult) ? certResult : []);
        const certificaciones = { 1: [], 2: [], 3: [] };
        certRows.forEach((row) => {
            if (certificaciones[row.year]) certificaciones[row.year].push(row);
        });

        res.render('index', { curriculum, commitments, diplomaturas: diplomRows, pasantias: pasRows, horario, certificaciones, config: configMap });
    } catch (err) {
        console.error('Error loading landing page:', err);
        res.render('index', {
            curriculum: { 1: [], 2: [], 3: [] },
            commitments: [],
            diplomaturas: [],
            pasantias: [],
            horario: null,
            certificaciones: { 1: [], 2: [], 3: [] },
            config: {}
        });
    }
});

// GET /diplomaturas — Página completa de diplomaturas
router.get('/diplomaturas', async (req, res) => {
    try {
        const [result, configResult] = await Promise.all([
            query('SELECT * FROM diplomaturas ORDER BY order_index'),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] }))
        ]);
        const diplomaturas = result?.result || result?.results || (Array.isArray(result) ? result : []);
        diplomaturas.forEach(d => { d.imagen_url = normalizeImgUrl(d.imagen_url); });

        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const configMap = {};
        configRows.forEach(r => { configMap[r.clave] = r.valor; });

        res.render('diplomaturas', { diplomaturas, config: configMap });
    } catch (err) {
        console.error('Error loading diplomaturas:', err);
        res.render('diplomaturas', { diplomaturas: [], config: {} });
    }
});

// GET /proyectosalumnos — Student Projects
router.get('/proyectosalumnos', async (req, res) => {
    try {
        const [projResult, testResult, configResult] = await Promise.all([
            query('SELECT * FROM student_projects ORDER BY year, order_index'),
            query('SELECT * FROM testimonios ORDER BY order_index').catch(() => ({ result: [] })),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] }))
        ]);
        const projRows = projResult?.result || projResult?.results || (Array.isArray(projResult) ? projResult : []);
        const testimonios = testResult?.result || testResult?.results || (Array.isArray(testResult) ? testResult : []);

        const projects = { 1: [], 2: [], 3: [] };
        projRows.forEach((row) => {
            row.tech_tags_arr = [];
            try {
                row.tech_tags_arr = JSON.parse(row.tech_tags || '[]');
            } catch (e) { }
            if (projects[row.year]) projects[row.year].push(row);
        });

        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const configMap = {};
        configRows.forEach(r => { configMap[r.clave] = r.valor; });

        res.render('proyectos', { projects, testimonios, config: configMap });
    } catch (err) {
        console.error('Error loading projects:', err);
        res.render('proyectos', { projects: { 1: [], 2: [], 3: [] }, testimonios: [], config: {} });
    }
});

// GET /servicios — Servicios tecnológicos integrales INCUYO
router.get('/servicios', async (req, res) => {
    try {
        const configResult = await query("SELECT * FROM configuracion").catch(() => ({ result: [] }));
        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const configMap = {};
        configRows.forEach(r => { configMap[r.clave] = r.valor; });
        res.render('Servicios', { config: configMap });
    } catch (err) {
        console.error('Error loading servicios:', err);
        res.render('Servicios', { config: {} });
    }
});

// GET /sabermas
router.get('/sabermas', async (req, res) => {
    try {
        const [currResult, certResult, configResult] = await Promise.all([
            query('SELECT * FROM curriculum ORDER BY year, order_index'),
            query('SELECT * FROM certificaciones_laborales ORDER BY year, order_index').catch(() => ({ result: [] })),
            query("SELECT * FROM configuracion").catch(() => ({ result: [] }))
        ]);
        const currRows = currResult?.result || currResult?.results || (Array.isArray(currResult) ? currResult : []);
        const curriculum = { 1: [], 2: [], 3: [] };
        currRows.forEach((row) => {
            if (curriculum[row.year]) curriculum[row.year].push(row);
        });

        const certRows = certResult?.result || certResult?.results || (Array.isArray(certResult) ? certResult : []);
        const certificaciones = { 1: [], 2: [], 3: [] };
        certRows.forEach((row) => {
            if (certificaciones[row.year]) certificaciones[row.year].push(row);
        });

        const configRows = configResult?.result || configResult?.results || (Array.isArray(configResult) ? configResult : []);
        const configMap = {};
        configRows.forEach(r => { configMap[r.clave] = r.valor; });

        res.render('masinfo', { curriculum, certificaciones, config: configMap });
    } catch (err) {
        console.error('Error loading sabermas:', err);
        res.render('masinfo', { curriculum: { 1: [], 2: [], 3: [] }, certificaciones: { 1: [], 2: [], 3: [] }, config: {} });
    }
});

// Redirigir /masinfo.html a /sabermas por compatibilidad
router.get('/masinfo.html', (req, res) => res.redirect('/sabermas'));

// Proxy for Cloud Storage Images to bypass CORS and hide API KEY
router.get('/api/storage/files/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        const baseUrl = process.env.SPIDER_API_URL ? process.env.SPIDER_API_URL.replace(/\/+$/, '') : '';
        const spiderUrl = `${baseUrl}/storage/files/${fileId}`;
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

// ─── LIVE CHAT — Solicitud de asistencia humana ───────────────────────────────

/**
 * POST /api/chat/request-human
 * Body: { history: [{role, content}], visitorKey?: string }
 * Crea (o retorna existente) una sesión de live chat y notifica a los admins.
 */
router.post('/api/chat/request-human', async (req, res) => {
    try {
        const { history = [], visitorKey } = req.body;

        // Si ya hay una clave, buscar sesión existente activa
        if (visitorKey) {
            const existing = await query(
                `SELECT id, status FROM chat_sessions WHERE session_key=? AND expires_at > NOW() AND status != 'closed'`,
                [visitorKey]
            );
            const rows = existing?.result || existing?.results || (Array.isArray(existing) ? existing : []);
            if (rows.length > 0) {
                return res.json({ ok: true, sessionKey: visitorKey, sessionId: rows[0].id, status: rows[0].status, alreadyExisted: true });
            }
        }

        // Crear nueva sesión
        const sessionId = uuidv4();
        const sessionKey = visitorKey || uuidv4();

        await query(
            `INSERT INTO chat_sessions (id, session_key, status, created_at, expires_at) VALUES (?, ?, 'waiting', NOW(), DATE_ADD(NOW(), INTERVAL 48 HOUR))`,
            [sessionId, sessionKey]
        );

        // Guardar el historial del bot como mensajes iniciales
        if (history.length > 0) {
            for (const msg of history) {
                const role = msg.role === 'user' ? 'user' : 'bot';
                const content = Array.isArray(msg.parts)
                    ? msg.parts.map(p => p.text || '').join('')
                    : (msg.content || '');
                if (content.trim()) {
                    await query(
                        `INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, NOW())`,
                        [sessionId, role, content.substring(0, 4000)]
                    );
                }
            }
        }

        // Notificar admins por email (en background, sin bloquear respuesta)
        const histForEmail = history.map(m => ({
            role: m.role === 'user' ? 'user' : 'bot',
            content: Array.isArray(m.parts)
                ? m.parts.map(p => p.text || '').join('')
                : (m.content || '')
        })).filter(m => m.content.trim());

        sendAdminNotificationEmail(sessionId, histForEmail).catch(err =>
            console.error('Email error (non-fatal):', err.message)
        );

        console.log(`🙋 [LiveChat] Nueva sesión creada: ${sessionId}`);
        res.json({ ok: true, sessionKey, sessionId, status: 'waiting' });
    } catch (err) {
        console.error('❌ [LiveChat] Error en request-human:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * GET /api/chat/session/:sessionKey/messages
 * Retorna todos los mensajes + estado de la sesión.
 * Usado por polling del usuario (cada 5s).
 */
router.get('/api/chat/session/:sessionKey/messages', async (req, res) => {
    try {
        const { sessionKey } = req.params;
        const { since } = req.query; // ID del último mensaje conocido

        const sessResult = await query(
            `SELECT id, status, admin_name, expires_at FROM chat_sessions WHERE session_key=? AND expires_at > NOW()`,
            [sessionKey]
        );
        const sessRows = sessResult?.result || sessResult?.results || (Array.isArray(sessResult) ? sessResult : []);

        if (!sessRows.length) {
            return res.json({ ok: false, expired: true, messages: [], status: 'closed' });
        }

        const session = sessRows[0];
        let msgQuery = `SELECT id, role, content, created_at FROM chat_messages WHERE session_id=?`;
        const params = [session.id];
        if (since) {
            msgQuery += ` AND id > ?`;
            params.push(parseInt(since));
        }
        msgQuery += ` ORDER BY id ASC`;

        const msgResult = await query(msgQuery, params);
        const messages = msgResult?.result || msgResult?.results || (Array.isArray(msgResult) ? msgResult : []);

        res.json({ ok: true, status: session.status, adminName: session.admin_name, messages });
    } catch (err) {
        console.error('❌ [LiveChat] Error en messages polling:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * POST /api/chat/session/:sessionKey/send
 * Body: { content: string }
 * Usuario envía un mensaje (cuando el admin tiene el control).
 */
router.post('/api/chat/session/:sessionKey/send', async (req, res) => {
    try {
        const { sessionKey } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ ok: false, error: 'content requerido' });
        }

        const sessResult = await query(
            `SELECT id, status FROM chat_sessions WHERE session_key=? AND expires_at > NOW() AND status='active'`,
            [sessionKey]
        );
        const sessRows = sessResult?.result || sessResult?.results || (Array.isArray(sessResult) ? sessResult : []);

        if (!sessRows.length) {
            return res.status(404).json({ ok: false, error: 'Sesión no encontrada o no activa' });
        }

        await query(
            `INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, 'user', ?, NOW())`,
            [sessRows[0].id, content.substring(0, 4000)]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error('❌ [LiveChat] Error en user send:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── SOLICITUD DE BECAS ──────────────────────────────────────────
router.post('/api/scholarships', async (req, res) => {
    try {
        const { first_name, last_name, email, phone, reason, age, high_school_finished, preferred_shifts } = req.body;
        
        if (!email) {
            return res.status(400).json({ ok: false, error: 'El correo electrónico es obligatorio' });
        }

        await query(
            `INSERT INTO scholarship_applications (first_name, last_name, email, phone, reason, age, high_school_finished, preferred_shifts, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [first_name || '', last_name || '', email, phone || '', reason || '', age || null, high_school_finished ? 1 : 0, preferred_shifts || '']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error('❌ Error en scholarship submit:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
