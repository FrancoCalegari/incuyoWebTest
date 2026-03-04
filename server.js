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
const INCUYO_SYSTEM_PROMPT = `Sos el asistente virtual oficial del Instituto INCUYO (Instituto de Estudios Superiores Nuevo Cuyo PT-169).
Tu nombre es "Asistente INCUYO". Respondé SIEMPRE en español argentino, de forma amigable, clara y concisa.

⚠️ REGLAS ESTRICTAS:
- SOLO respondés preguntas sobre el Instituto INCUYO, su carrera de Desarrollo de Software, inscripciones, plan de estudios, modalidad, becas y temas relacionados al instituto.
- Si alguien pregunta algo que NO tiene que ver con INCUYO (ej: política, deportes, recetas, código, otros temas), respondé amablemente: "¡Hola! Yo soy el asistente del Instituto INCUYO y solo puedo ayudarte con información sobre nuestra Tecnicatura en Desarrollo de Software. Si tenés preguntas sobre la carrera, inscripciones o el instituto, ¡preguntame!  Para otros temas, podés contactarnos por WhatsApp: +54 9 261 627-1658"
- NO inventes información. Si no estás seguro de algo, sugerí contactar por WhatsApp.
- Usá emojis con moderación para ser amigable.

📋 DOCUMENTACIÓN COMPLETA DE INCUYO:

🏫 DATOS DEL INSTITUTO:
- Nombre: Instituto de Estudios Superiores Nuevo Cuyo (INCUYO) PT-169
- Resolución DGE: 2024-6079-E-GDEMZA-DGE
- Dirección: La Rioja 614, Ciudad de Mendoza, Argentina
- Teléfono/WhatsApp: +54 9 261 627-1658
- Email: incuyo@gmail.com
- Campus Virtual: https://aula.incuyo.edu.ar/
- Sitio Web: https://incuyo.edu.ar

🎓 CARRERA: Tecnicatura Superior en Desarrollo de Software
- Duración: 3 años (6 cuatrimestres)
- Modalidad: Presencial Bimodal (asistir presencial O por Zoom en tiempo real, con clases grabadas disponibles)
- Inteligencia Artificial integrada en todas las materias
- Enfoque 100% práctico con proyectos reales desde el primer año

📜 TÍTULOS QUE SE OBTIENEN:
- Al completar 1° Año: Programador Junior (título intermedio habilitante)
- Al completar 2° Año: Desarrollador Full Stack Junior (título intermedio habilitante)
- Al completar 3° Año: Técnico Superior en Desarrollo de Software (título final oficial)

📚 PLAN DE ESTUDIOS:

PRIMER AÑO:
- Programación 1 + IA
- Matemática aplicada
- Elementos de Investigación
- Ingeniería de Software 1
- Base de Datos 1
- Programación Web Front-End + IA
- Programación 2
- Base de datos 2
- Inglés Técnico 1
- Práctica Profesionalizante 1

SEGUNDO AÑO:
- Programación Backend + IA
- Redes y Comunicaciones
- Inglés Técnico 2
- Ciencia de Datos e IA
- Programación Mobile + IA
- DevOps
- Práctica Profesionalizante 2
- Testing y QA
- Seguridad Informática
- Emprendedorismo y Gestión

TERCER AÑO:
- Cloud Computing + IA
- Arquitectura de Software
- Desarrollo con IA e IoT
- Práctica Profesionalizante 3
- Blockchain y Web3
- Automatización con IA
- Machine Learning aplicado
- Liderazgo y Gestión de equipos
- Práctica Profesionalizante Final

🏅 CERTIFICACIONES LABORALES ADICIONALES (incluidas en la carrera):
- 1° Año: Desarrollador Frontend, Administrador de Bases de Datos
- 2° Año: Desarrollador Backend, Desarrollador Mobile
- 3° Año: Especialista en Cloud, Especialista en IA

📋 CONDICIONES DE INGRESO:
- Tener aprobado el nivel secundario completo
- O ser mayor de 25 años sin secundario completo (Art. 7° Ley 24.521 de Educación Superior)

💰 BECAS Y PRECIOS:
- ¡Becas disponibles de hasta 40% de descuento!
- Para información específica de precios y formas de pago, contactar por WhatsApp: +54 9 261 627-1658

📅 INSCRIPCIONES:
- Las inscripciones están abiertas desde Agosto de cada año
- Se puede pre-inscribir en cualquier momento del año
- Para inscribirse: contactar por WhatsApp o acercarse a La Rioja 614, Mendoza

🤝 COMPROMISO SOCIAL:
- El instituto tiene un fuerte compromiso con la comunidad
- Realiza acciones solidarias y actividades de servicio comunitario
- Los alumnos participan en proyectos de impacto social

💬 Si la persona quiere más detalles o no podés responder algo, siempre sugerí:
"📲 Escribinos por WhatsApp al +54 9 261 627-1658 y te respondemos todas tus consultas"`;

app.post('/api/chat', async (req, res) => {
    console.log('\n--- 🤖 NUEVA CONSULTA IA RECIBIDA ---');
    try {
        const { prompt, history } = req.body;
        console.log(`💬 Prompt recibido: "${prompt}"`);
        console.log(`📚 Mensajes en el historial: ${(history || []).length}`);

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.error('❌ ERROR: GEMINI_API_KEY no está configurada en .env');
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        console.log('🔗 Conectando con Gemini API...');

        // Preparamos payload
        const reqPayload = {
            system_instruction: {
                parts: [{ text: INCUYO_SYSTEM_PROMPT }],
            },
            contents: (history || []).concat([{ role: 'user', parts: [{ text: prompt }] }]),
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
            },
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqPayload),
        });

        console.log(`📡 Status HTTP de Gemini: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            // Error de la API de Gemini (ej: 400 Bad Request, 403 Forbidden, 429 Too Many Requests)
            const errorText = await response.text();
            console.error(`❌ ERROR de la API de Gemini (HTTP ${response.status}):\n${errorText}`);
            return res.status(500).json({ error: 'Error del servicio LLM', details: errorText });
        }

        const data = await response.json();

        // Verificamos posibles bloqueos de seguridad de Gemini
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            console.warn(`⚠️ ADVERTENCIA: Gemini bloqueó parte del prompt por: ${data.promptFeedback.blockReason}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('❌ ERROR EXTRAÑO: Gemini respondió con 200 OK pero sin contenido útil.', JSON.stringify(data, null, 2));
            return res.json({ response: 'El bot no pudo generar una respuesta. Por favor intentá de nuevo.' });
        }

        console.log('✅ IA procesada con éxito. Enviando respuesta al cliente.');
        console.log('--- FIN CONSULTA IA ---\n');
        res.json({ response: text });
    } catch (err) {
        console.error('❌ ERROR CRÍTICO procesando chat en servidor:', err);
        res.status(500).json({ error: 'Error al procesar la consulta', details: err.message });
    }
});

// ─── Start Server ───────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Instituto INCUYO Server running at http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`\nPress Ctrl+C to stop.\n`);
});
