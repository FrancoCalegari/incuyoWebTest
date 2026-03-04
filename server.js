/**
 * INCUYO Web — Express Server
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── View Engine ─────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middleware ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'incuyo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

// ─── Routes ─────────────────────────────────────────
app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

// ─── Gemini Chatbot Proxy ───────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, history } = req.body;
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{
                        text: `Sos el asistente virtual del Instituto INCUYO (Instituto de Estudios Superiores Nuevo Cuyo PT-169). 
Respondé siempre en español argentino, de forma amigable y concisa.

Información clave:
- Tecnicatura Superior en Desarrollo de Software (3 años, 6 cuatrimestres)
- Modalidad: Presencial - Bimodal (se puede cursar por Zoom, clases grabadas)
- Títulos intermedios: Programador Junior (1° año) y Desarrollador Full Stack Junior (2° año)
- Título final: Técnico Superior en Desarrollo de Software
- Becas con hasta 40% de descuento
- Inscripciones abiertas desde Agosto
- Ubicación: La Rioja 614, Ciudad de Mendoza, Argentina
- Teléfono WhatsApp: +54 9 261 627-1658
- Email: incuyo@gmail.com
- Campus Virtual: https://aula.incuyo.edu.ar/
- Resolución: 2024-6079-E-GDEMZA-DGE
- Condiciones de ingreso: Secundario aprobado o mayor de 25 años (Art. 7° Ley 24.521)
- IA integrada en las materias
- Certificaciones laborales adicionales por año

Si te preguntan algo que no sabés del instituto, sugerí contactar por WhatsApp.`
                    }],
                },
                contents: (history || []).concat([{ role: 'user', parts: [{ text: prompt }] }]),
            }),
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento, no pude procesar tu pregunta.';
        res.json({ response: text });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Error al procesar la consulta' });
    }
});

// ─── Start Server ───────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Instituto INCUYO Server running at http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`\nPress Ctrl+C to stop.\n`);
});
