/**
 * INCUYO Chatbot Module
 * Módulo de inteligencia artificial separado del servidor principal.
 * Carga dinámicamente desde la DB: plan de estudios (curriculum) y diplomaturas.
 */

const fetch = require('node-fetch');
const { query } = require('./spider');

// ─── Constantes del prompt base (no cambia con la DB) ─────────────────────────
const SYSTEM_PROMPT_BASE = `Sos el asistente virtual oficial del Instituto INCUYO (Instituto de Estudios Superiores Nuevo Cuyo PT-169).
Tu nombre es "Asistente INCUYO". Respondé SIEMPRE en español argentino, de forma amigable, clara y concisa.

⚠️ REGLAS ESTRICTAS:
- SOLO respondés preguntas sobre el Instituto INCUYO, su carrera de Desarrollo de Software, inscripciones, plan de estudios, modalidad, becas y temas relacionados al instituto.
- Si alguien pregunta algo que NO tiene que ver con INCUYO (ej: política, deportes, recetas, código, otros temas), respondé amablemente: "¡Hola! Yo soy el asistente del Instituto INCUYO y solo puedo ayudarte con información sobre nuestra Tecnicatura en Desarrollo de Software. Si tenés preguntas sobre la carrera, inscripciones o el instituto, ¡preguntame! Para otros temas, podés contactarnos por WhatsApp: +54 9 261 627-1658"
- NO inventes información. Si no estás seguro de algo, sugerí contactar por WhatsApp.
- Usá emojis con moderación para ser amigable.

📋 DOCUMENTACIÓN COMPLETA DE INCUYO:

🏫 DATOS DEL INSTITUTO:
- Nombre: Instituto de Estudios Superiores Nuevo Cuyo (INCUYO) PT-169
- Resolución DGE: 6079/DGE
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

🏅 CERTIFICACIONES LABORALES ADICIONALES (incluidas en la carrera):
- 1° Año: Técnico en Hardware y Software, Programador Python (nivel Junior)
- 2° Año: Sistemas Operativos (Linux-Windows), Sistemas de Programación Pymes, Análisis y Técnicas de sistemas
- 3° Año: Diseño y programación de páginas web, WEB SITE con base de datos dinámicas, Inteligencia Artificial en la nube

📋 CONDICIONES DE INGRESO:
- Tener aprobado el nivel secundario completo
- O ser mayor de 25 años sin secundario completo (Art. 7° Ley 24.521 de Educación Superior) — rinde examen pero no el de ingreso

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

// ─── Carga dinámica del plan de estudios desde la DB ─────────────────────────
async function buildCurriculumSection() {
    try {
        const result = await query(
            'SELECT year, subject_name, order_index FROM curriculum ORDER BY year ASC, order_index ASC'
        );
        const rows = result.results || result || [];

        if (!rows.length) return null;

        // Agrupar por año
        const byYear = {};
        rows.forEach(({ year, subject_name }) => {
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(subject_name);
        });

        const yearNames = { 1: 'PRIMER AÑO', 2: 'SEGUNDO AÑO', 3: 'TERCER AÑO' };
        let section = '📚 PLAN DE ESTUDIOS (actualizado desde la base de datos):\n\n';

        Object.keys(byYear).sort().forEach(year => {
            const label = yearNames[year] || `AÑO ${year}`;
            section += `${label}:\n`;
            byYear[year].forEach(subject => {
                section += `- ${subject}\n`;
            });
            section += '\n';
        });

        return section.trim();
    } catch (err) {
        console.warn('⚠️ [Chatbot] No se pudo cargar el curriculum desde la DB:', err.message);
        return null;        // Fallback: se usará el plan estático de ser necesario
    }
}

// ─── Carga dinámica de diplomaturas desde la DB ───────────────────────────────
async function buildDiplomaturasSection() {
    try {
        const result = await query(
            'SELECT nombre FROM diplomaturas ORDER BY order_index ASC, id ASC'
        );
        const rows = result.results || result || [];

        if (!rows.length) return null;

        let section = '🎓 CURSOS Y DIPLOMATURAS DISPONIBLES (actualizados desde la base de datos):\n';
        rows.forEach(({ nombre }) => {
            section += `- ${nombre}\n`;
        });

        return section.trim();
    } catch (err) {
        console.warn('⚠️ [Chatbot] No se pudo cargar las diplomaturas desde la DB:', err.message);
        return null;
    }
}

// ─── Construcción del system prompt completo (dinámico) ───────────────────────
async function buildSystemPrompt() {
    const [curriculumSection, diplomaturasSection] = await Promise.all([
        buildCurriculumSection(),
        buildDiplomaturasSection(),
    ]);

    let prompt = SYSTEM_PROMPT_BASE;

    // Insertar el plan de estudios dinámico antes de las certificaciones
    if (curriculumSection) {
        prompt = prompt.replace(
            '🏅 CERTIFICACIONES LABORALES ADICIONALES',
            `${curriculumSection}\n\n🏅 CERTIFICACIONES LABORALES ADICIONALES`
        );
    } else {
        // Plan de estudios estático de respaldo
        const fallbackCurriculum = `📚 PLAN DE ESTUDIOS:

PRIMER AÑO:
- Programación 1 (python) + IA
- Matemática aplicada
- Base de Datos 1
- Inglés Técnico 1
- Práctica Profesionalizante 1
- Arquitectura de Dispositivos
- Alfabetización académica
- Lógica Computacional
- Sistemas Operativos 1
- Seminario Nuevas Tecnologías

SEGUNDO AÑO:
- Programación 2 (python + POO) + IA
- Inglés Técnico 2
- Práctica Profesionalizante 2
- Base de datos 2
- Modelado de software
- Comunicación y redes
- Matemática discreta
- Sistemas operativos 2
- Análisis Matemático

TERCER AÑO:
- Programación 3
- Práctica Profesionalizante 3
- Arquitectura y diseño de interfaces: UI y UX
- Base de datos 3
- Metodologías ágiles
- Práctica Profesionalizante Final
- Gestión de proyectos de software
- Estadística y probabilidades para el desarrollo de software
- Legislación Informática y ética profesional
- Auditoría y Calidad de Sistemas
- Ciberseguridad
- Inglés técnico 3`;

        prompt = prompt.replace(
            '🏅 CERTIFICACIONES LABORALES ADICIONALES',
            `${fallbackCurriculum}\n\n🏅 CERTIFICACIONES LABORALES ADICIONALES`
        );
    }

    // Insertar diplomaturas antes de la sección de certificaciones laborales
    if (diplomaturasSection) {
        prompt = prompt.replace(
            '🏅 CERTIFICACIONES LABORALES ADICIONALES',
            `${diplomaturasSection}\n\n🏅 CERTIFICACIONES LABORALES ADICIONALES`
        );
    }

    return prompt;
}

// ─── Handler principal del endpoint /api/chat ─────────────────────────────────
async function handleChat(req, res) {
    console.log('\n--- 🤖 NUEVA CONSULTA IA RECIBIDA ---');
    try {
        const { prompt, history } = req.body;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ error: 'El campo "prompt" es requerido.' });
        }

        console.log(`💬 Prompt recibido: "${prompt}"`);
        console.log(`📚 Mensajes en el historial: ${(history || []).length}`);

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.error('❌ ERROR: GEMINI_API_KEY no está configurada en .env');
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        // Construir el prompt con datos dinámicos de la DB
        console.log('📦 Cargando contexto dinámico desde la base de datos...');
        const systemPrompt = await buildSystemPrompt();
        console.log('✅ Contexto dinámico listo.');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        console.log('🔗 Conectando con Gemini API...');

        const reqPayload = {
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: (history || []).concat([{ role: 'user', parts: [{ text: prompt }] }]),
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 600,
            },
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqPayload),
        });

        console.log(`📡 Status HTTP de Gemini: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            } catch (_) {
                errorDetails = await response.text();
            }
            console.error(`❌ ERROR de la API de Gemini (HTTP ${response.status}):`, errorDetails);
            return res.status(500).json({
                error: 'Error del servicio LLM',
                details: errorDetails,
                status: response.status,
            });
        }

        const data = await response.json();

        if (data.promptFeedback?.blockReason) {
            console.warn(`⚠️  Gemini bloqueó el prompt por: ${data.promptFeedback.blockReason}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('❌ Gemini respondió con 200 OK pero sin contenido útil:', JSON.stringify(data, null, 2));
            return res.json({ response: 'El bot no pudo generar una respuesta. Por favor intentá de nuevo.' });
        }

        console.log('✅ IA procesada con éxito. Enviando respuesta al cliente.');
        console.log('--- FIN CONSULTA IA ---\n');
        res.json({ response: text });

    } catch (err) {
        console.error('❌ ERROR CRÍTICO procesando chat en servidor:', err);
        res.status(500).json({ error: 'Error al procesar la consulta', details: err.message });
    }
}

module.exports = { handleChat };
