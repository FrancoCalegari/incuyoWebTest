/**
 * INCUYO Chatbot Module
 * Usa un system prompt liviano + inyección de contexto DB como mensaje de asistente,
 * evitando incrustar datos masivos de la base de datos en cada consulta.
 * Caché de 5 minutos en memoria para el contexto de la DB.
 */

'use strict';

const fetch = require('node-fetch');
const { query } = require('./spider');

// ─── System Prompt base (fijo, sin datos de DB) ───────────────────────────────
// Contiene solo reglas de comportamiento e información estática del instituto.
// Los datos dinámicos (curriculum, diplomaturas) se inyectan por separado.
const SYSTEM_PROMPT_BASE = `Sos el asistente virtual oficial del Instituto INCUYO (Instituto de Estudios Superiores Nuevo Cuyo PT-169).
Tu nombre es "Asistente INCU". Respondé SIEMPRE en español argentino, de forma amigable, clara y concisa.

⚠️ REGLAS ESTRICTAS:
- SOLO respondés preguntas sobre el Instituto INCUYO, su carrera de Desarrollo de Software, inscripciones, plan de estudios, modalidad, becas y temas relacionados al instituto.
- Si alguien pregunta algo que NO tiene que ver con INCUYO (ej: política, deportes, recetas, código, otros temas), respondé amablemente: "¡Hola! Yo soy el asistente del Instituto INCU y solo puedo ayudarte con información sobre nuestra Tecnicatura en Desarrollo de Software. Si tenés preguntas sobre la carrera, inscripciones o el instituto, ¡preguntame! Para otros temas, podés contactarnos por WhatsApp: +54 9 261 627-1658"
- NO inventes información. Si no estás seguro de algo, sugerí contactar por WhatsApp.
- Usá emojis con moderación para ser amigable.
- NUNCA inventes materias, diplomaturas ni certificaciones. Usá SIEMPRE las tools o el contexto disponible.

🛠️ TOOLS DISPONIBLES — usálas cuando corresponda:
- get_materias_carrera: cuando pregunten por las materias, plan de estudios, qué se estudia o asignaturas en general.
- get_materias_year: cuando pregunten por materias de un año específico (1°, 2° o 3° año).
- get_diplomaturas: cuando pregunten por diplomaturas, cursos cortos u opciones adicionales.

📖 CÓMO MOSTRAR MATERIAS:
Cuando uses una tool y recibas los datos:
1. Organizá las materias por año y cuatrimestre en lista clara.
2. Formato: 📚 1° AÑO:\n   - Materia (cuatrimestre)
3. Al final de cada año, mencioná certificaciones laborales si las hay.
4. Cerrá invitando al WhatsApp para más info.

📋 INFORMACIÓN FIJA DEL INSTITUTO:

🏫 DATOS:
- Nombre: Instituto de Estudios Superiores Nuevo Cuyo (INCUYO) PT-169
- Resolución DGE: 6079/DGE
- Dirección: La Rioja 614, Ciudad de Mendoza, Argentina
- Teléfono/WhatsApp: +54 9 261 627-1658
- Email: incuyo@gmail.com
- Campus Virtual: https://aula.incuyo.edu.ar/
- Sitio Web: https://incuyo.edu.ar

🎓 CARRERA: Tecnicatura Superior en Desarrollo de Software
- Duración: 3 años (6 cuatrimestres)
- Modalidad: Bimodal (presencial O por Zoom en tiempo real, con clases grabadas)
- IA integrada en todas las materias
- Enfoque 100% práctico con proyectos reales desde el primer año

📜 TÍTULOS:
- 2° Año: Programador Junior | Desarrollador Full Stack Junior (título intermedio habilitante)
- 3° Año: Técnico Superior en Desarrollo de Software (título final oficial)

📋 INGRESO:
- Secundario completo aprobado
- O mayor de 25 años sin secundario (Art. 7° Ley 24.521) — rinde examen pero no el de ingreso

💰 BECAS — CICLO LECTIVO 2027:
INCUYO es la única institución educativa que ofrece respaldo económico mediante becas a sus alumnos, gracias al patrocinio de empresas líderes.
- Descuentos disponibles: 30%, 40% y 50% OFF durante los 3 años de la carrera.
- Inscripciones con becas disponibles desde Agosto.

Turnos disponibles:
  🌅 Turno Mañana (9:00 a 13:00 hs): Ideal para quienes salen de la secundaria.
  🌞 Turno Tarde (14:00 a 17:30 hs): Ideal para quienes estudian y trabajan.
  🌆 Turno Vespertino (18:00 a 21:00 hs): Pensado para quienes trabajan de día.

Modalidad: Bimodal — método comprobado con clases prácticas 3 veces por semana y 2 asincrónicas.

Para solicitar una beca, sugerí siempre: "📲 Escribinos por WhatsApp al +54 9 261 627-1658 para solicitar tu beca."

📅 INSCRIPCIONES: Abiertas desde Agosto. Pre-inscripción disponible todo el año.

💬 Ante cualquier duda no resuelta, sugerí: "📲 Escribinos por WhatsApp al +54 9 261 627-1658"`;

// ─── Caché de contexto DB con TTL ─────────────────────────────────────────────
let _dbContextCache = null;
let _dbContextExpiry = 0;
const DB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Carga curriculum, diplomaturas, certificaciones y horario desde la DB.
 * Usa caché en memoria con TTL de 5 minutos para evitar queries en cada consulta.
 * @returns {{ curriculum: Object, diplomaturas: Array, certificaciones: Object, horario: Array|null }}
 */
async function buildDbContext() {
    const now = Date.now();
    if (_dbContextCache && now < _dbContextExpiry) {
        console.log('📦 [DB context] Cargado desde caché.');
        return _dbContextCache;
    }

    console.log('📦 [DB context] Consultando base de datos...');

    const [currResult, diplomResult, certResult, configResult] = await Promise.allSettled([
        query('SELECT year, subject_name, semestre, order_index FROM curriculum ORDER BY year ASC, order_index ASC'),
        query('SELECT nombre, descripcion_breve, fecha_inicio FROM diplomaturas ORDER BY order_index ASC, id ASC'),
        query('SELECT year, nombre, order_index FROM certificaciones_laborales ORDER BY year ASC, order_index ASC'),
        query(`SELECT valor FROM configuracion WHERE clave='horario' LIMIT 1`),
    ]);

    // ── Curriculum agrupado por año ──
    const curriculum = { 1: [], 2: [], 3: [] };
    if (currResult.status === 'fulfilled') {
        const rows = currResult.value?.result || currResult.value?.results || (Array.isArray(currResult.value) ? currResult.value : []);
        rows.forEach(({ year, subject_name, semestre }) => {
            const yr = parseInt(year);
            if (!curriculum[yr]) curriculum[yr] = [];
            curriculum[yr].push(semestre ? `${subject_name} (${semestre})` : subject_name);
        });
    } else {
        console.warn('⚠️ [DB context] curriculum falló:', currResult.reason?.message);
    }

    // ── Diplomaturas ──
    const diplomaturas = [];
    if (diplomResult.status === 'fulfilled') {
        const rows = diplomResult.value?.result || diplomResult.value?.results || (Array.isArray(diplomResult.value) ? diplomResult.value : []);
        rows.forEach(({ nombre, descripcion_breve, fecha_inicio }) => {
            diplomaturas.push({ nombre, descripcion_breve: descripcion_breve || '', fecha_inicio: fecha_inicio || '' });
        });
    } else {
        console.warn('⚠️ [DB context] diplomaturas falló:', diplomResult.reason?.message);
    }

    // ── Certificaciones laborales agrupadas por año ──
    const certificaciones = { 1: [], 2: [], 3: [] };
    if (certResult.status === 'fulfilled') {
        const rows = certResult.value?.result || certResult.value?.results || (Array.isArray(certResult.value) ? certResult.value : []);
        rows.forEach(({ year, nombre }) => {
            const yr = parseInt(year);
            if (!certificaciones[yr]) certificaciones[yr] = [];
            certificaciones[yr].push(nombre);
        });
    } else {
        console.warn('⚠️ [DB context] certificaciones falló:', certResult.reason?.message);
    }

    // ── Horario desde configuracion ──
    let horario = null;
    if (configResult.status === 'fulfilled') {
        const rows = configResult.value?.result || configResult.value?.results || (Array.isArray(configResult.value) ? configResult.value : []);
        if (rows.length > 0) {
            try { horario = JSON.parse(rows[0].valor); } catch (e) { horario = null; }
        }
    } else {
        console.warn('⚠️ [DB context] horario falló:', configResult.reason?.message);
    }

    const ctx = { curriculum, diplomaturas, certificaciones, horario };
    _dbContextCache = ctx;
    _dbContextExpiry = now + DB_CACHE_TTL_MS;
    console.log('✅ [DB context] Cargado y cacheado por 5 minutos.');
    return ctx;
}

/**
 * Invalida el caché de contexto DB manualmente (útil cuando el admin edita datos).
 */
function invalidateDbContextCache() {
    _dbContextCache = null;
    _dbContextExpiry = 0;
    console.log('🔄 [DB context] Caché invalidado.');
}

/**
 * Normaliza la respuesta de query() a un array simple.
 * @param {*} result
 * @returns {Array}
 */
function normalizeRows(result) {
    return result?.result || result?.results || (Array.isArray(result) ? result : []);
}

/**
 * Formatea el contexto DB en un texto compacto para inyectar como mensaje de asistente.
 * Si el usuario pregunta por un año específico (ej. 'primer año'), solo se inyectan las materias de ese año.
 * @param {{ curriculum: Object, diplomaturas: Array, certificaciones: Object, horario: Array|null }} ctx
 * @param {string} prompt - El mensaje actual del usuario para detectar la intención de año
 * @returns {string}
 */
function formatContextMessage(ctx, prompt = '') {
    const lines = ['[CONTEXTO_INCUYO — datos actualizados de la base de datos]', ''];
    
    const p = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let targetYears = [1, 2, 3];
    
    // Si la consulta menciona materias y un año específico, filtramos para ser más precisos
    const isMateriaQuery = /materia|asignatura|plan.*estudio|que se estudia|que se ve|contenido|curriculum/.test(p);
    if (isMateriaQuery) {
        const hasYear1 = /1er|primer|1|uno/.test(p);
        const hasYear2 = /2do|segundo|2|dos/.test(p);
        const hasYear3 = /3er|tercer|3|tres/.test(p);
        
        if (hasYear1 || hasYear2 || hasYear3) {
            targetYears = [];
            if (hasYear1) targetYears.push(1);
            if (hasYear2) targetYears.push(2);
            if (hasYear3) targetYears.push(3);
        }
    }

    // Plan de estudios
    const yearNames = { 1: '1° AÑO', 2: '2° AÑO', 3: '3° AÑO' };
    const hasAnySubjects = targetYears.some(yr => (ctx.curriculum[yr] || []).length > 0);
    if (hasAnySubjects) {
        lines.push('📚 PLAN DE ESTUDIOS (Materias):');
        targetYears.forEach(yr => {
            const subjects = ctx.curriculum[yr] || [];
            if (subjects.length) {
                lines.push(`${yearNames[yr]}: ${subjects.join(' | ')}`);
            }
        });
        lines.push('');
    }

    // Certificaciones laborales
    const hasAnyCert = targetYears.some(yr => (ctx.certificaciones[yr] || []).length > 0);
    if (hasAnyCert) {
        lines.push('🏅 CERTIFICACIONES LABORALES ADICIONALES:');
        targetYears.forEach(yr => {
            const certs = ctx.certificaciones[yr] || [];
            if (certs.length) {
                lines.push(`${yearNames[yr]}: ${certs.join(' | ')}`);
            }
        });
        lines.push('');
    }

    // Diplomaturas
    if (ctx.diplomaturas.length > 0) {
        lines.push('🎓 CURSOS Y DIPLOMATURAS DISPONIBLES:');
        ctx.diplomaturas.forEach(({ nombre, descripcion_breve, fecha_inicio }) => {
            let entry = `- ${nombre}`;
            if (descripcion_breve) entry += `: ${descripcion_breve}`;
            if (fecha_inicio) entry += ` (Inicio: ${fecha_inicio})`;
            lines.push(entry);
        });
        lines.push('');
    }

    // Horario de atención
    if (Array.isArray(ctx.horario) && ctx.horario.length > 0) {
        lines.push('⏰ HORARIO DE ATENCIÓN AL PÚBLICO:');
        ctx.horario.forEach(({ dia, abierto, apertura, cierre }) => {
            if (abierto) {
                lines.push(`- ${dia}: ${apertura} a ${cierre}`);
            } else {
                lines.push(`- ${dia}: Cerrado`);
            }
        });
        lines.push('');
    }

    lines.push('[FIN_CONTEXTO_INCUYO]');
    return lines.join('\n');
}

/**
 * Mensajes base para SpiderIA: SIEMPRE inyecta el contexto DB como primer mensaje del asistente.
 * Así el modelo siempre tiene los datos disponibles, sin depender de tool calling.
 */
async function buildBaseMessages(history, prompt) {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT_BASE }];

    // Inyectar contexto DB en todos los mensajes (no depender de tools del modelo)
    try {
        const dbCtx = await buildDbContext();
        messages.push({ role: 'assistant', content: formatContextMessage(dbCtx, prompt) });
    } catch (e) {
        console.warn('⚠️ [buildBaseMessages] No se pudo inyectar contexto DB:', e.message);
    }

    // Agregar historial (salteando mensajes de contexto anteriores para no duplicar)
    (history || []).forEach(h => {
        const role = h.role === 'model' ? 'assistant' : 'user';
        const content = Array.isArray(h.parts)
            ? h.parts.map(p => p.text || '').join('')
            : (h.content || '');
        if (content.includes('[CONTEXTO_INCUYO')) return; // no duplicar
        messages.push({ role, content });
    });

    messages.push({ role: 'user', content: prompt });
    return messages;
}

/**
 * Mensajes para Gemini (CON contexto DB pre-cargado como mensaje de asistente).
 */
function buildMessagesWithContext(history, prompt, dbContext) {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT_BASE }];
    messages.push({ role: 'assistant', content: formatContextMessage(dbContext, prompt) });
    (history || []).forEach(h => {
        const role = h.role === 'model' ? 'assistant' : 'user';
        const content = Array.isArray(h.parts)
            ? h.parts.map(p => p.text || '').join('')
            : (h.content || '');
        if (content.includes('[CONTEXTO_INCUYO')) return;
        messages.push({ role, content });
    });
    messages.push({ role: 'user', content: prompt });
    return messages;
}

// ─── SpiderIA ──────────────────────────────────────────────────────────────────
const SPIDER_IA_URL = process.env.SPIDER_API_URL ? process.env.SPIDER_API_URL.replace(/\/+$/, '') : '';
const SPIDER_TIMEOUT_MS = 60000;

/**
 * Modo debug: mostrá el payload completo enviado a la IA en consola.
 * Activar con CHATBOT_DEBUG=true en .env
 */
const CHATBOT_DEBUG = process.env.CHATBOT_DEBUG === 'true';

function debugLogMessages(provider, messages) {
    if (!CHATBOT_DEBUG) return;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🐛 [DEBUG] Payload completo → ${provider}`);
    console.log('═'.repeat(60));
    messages.forEach((m, i) => {
        const preview = m.content?.length > 500
            ? m.content.slice(0, 500) + `... [+${m.content.length - 500} chars]`
            : m.content;
        console.log(`\n[${i}] role: ${m.role}`);
        console.log(preview);
    });
    console.log('\n' + '═'.repeat(60) + '\n');
}

// ─── Tool Definitions (OpenAI format) ─────────────────────────────────────────
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_materias_carrera',
            description: 'Obtiene TODAS las materias del plan de estudios de la Tecnicatura en Desarrollo de Software, organizadas por año y cuatrimestre. Usar cuando pregunten por las materias, plan de estudios, qué se estudia o asignaturas en general.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_materias_year',
            description: 'Obtiene las materias de un año específico de la carrera. Usar cuando pregunten por materias de 1° año, 2° año o 3° año en particular.',
            parameters: {
                type: 'object',
                properties: {
                    year: {
                        type: 'integer',
                        description: 'El año de la carrera: 1 (primer año), 2 (segundo año) o 3 (tercer año)',
                        enum: [1, 2, 3],
                    },
                },
                required: ['year'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_diplomaturas',
            description: 'Obtiene la lista de diplomaturas y cursos cortos disponibles en el Instituto INCUYO. Usar cuando pregunten por diplomaturas, cursos adicionales u opciones de capacitación.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
];

/**
 * Ejecuta una tool llamada por el modelo y retorna el resultado como string JSON.
 * @param {string} name - Nombre de la tool
 * @param {Object} args - Argumentos parseados
 * @returns {Promise<string>} JSON string con el resultado
 */
async function executeTool(name, args) {
    try {
        switch (name) {
            case 'get_materias_carrera': {
                const rows = normalizeRows(await query(
                    'SELECT year, subject_name, semestre FROM curriculum ORDER BY year ASC, order_index ASC'
                ));
                const byYear = { 1: [], 2: [], 3: [] };
                rows.forEach(r => {
                    const yr = parseInt(r.year);
                    if (!byYear[yr]) byYear[yr] = [];
                    byYear[yr].push(r.semestre ? `${r.subject_name} (${r.semestre})` : r.subject_name);
                });
                // También traer certificaciones
                const certRows = normalizeRows(await query(
                    'SELECT year, nombre FROM certificaciones_laborales ORDER BY year ASC, order_index ASC'
                ));
                const certs = { 1: [], 2: [], 3: [] };
                certRows.forEach(r => { const yr = parseInt(r.year); (certs[yr] = certs[yr] || []).push(r.nombre); });
                return JSON.stringify({ plan_de_estudios: byYear, certificaciones_laborales: certs });
            }
            case 'get_materias_year': {
                const yr = parseInt(args.year);
                if (![1, 2, 3].includes(yr)) return JSON.stringify({ error: 'El año debe ser 1, 2 o 3' });
                const rows = normalizeRows(await query(
                    'SELECT subject_name, semestre FROM curriculum WHERE year=? ORDER BY order_index ASC',
                    [yr]
                ));
                const materias = rows.map(r => r.semestre ? `${r.subject_name} (${r.semestre})` : r.subject_name);
                const certRows = normalizeRows(await query(
                    'SELECT nombre FROM certificaciones_laborales WHERE year=? ORDER BY order_index ASC',
                    [yr]
                ));
                return JSON.stringify({ year: yr, materias, certificaciones: certRows.map(r => r.nombre) });
            }
            case 'get_diplomaturas': {
                const rows = normalizeRows(await query(
                    'SELECT nombre, descripcion_breve, fecha_inicio FROM diplomaturas ORDER BY order_index ASC, id ASC'
                ));
                return JSON.stringify({ diplomaturas: rows });
            }
            default:
                return JSON.stringify({ error: `Tool desconocida: ${name}` });
        }
    } catch (err) {
        console.error(`❌ [Tool] Error ejecutando ${name}:`, err.message);
        return JSON.stringify({ error: err.message });
    }
}

/**
 * ID del modelo preferido seteado desde el admin dashboard.
 * null = auto (usa models[0] de la API).
 */
let _preferredModelId = null;
/** Cache del modelo resuelto (puede ser el preferido o el auto) */
let _spiderModelId = null;

/**
 * Fija el modelo preferido de SpiderIA.
 * Resetea la caché para que se aplique en la próxima consulta.
 * @param {number|string|null} modelId
 */
function setPreferredModel(modelId) {
    _preferredModelId = modelId !== undefined ? modelId : null;
    _spiderModelId = null; // invalidar caché
    console.log(`🔧 [SpiderIA] Modelo preferido actualizado: ${_preferredModelId ?? 'auto'}`);
}

/**
 * Retorna el modelo preferido actual (null = auto).
 */
function getPreferredModel() {
    return _preferredModelId;
}

async function getSpiderModel() {
    // Si hay un modelo preferido configurado, usarlo directamente
    if (_preferredModelId !== null) {
        if (_spiderModelId !== _preferredModelId) {
            _spiderModelId = _preferredModelId;
            console.log(`🕷️  SpiderIA model (preferido): ${_spiderModelId}`);
        }
        return _spiderModelId;
    }

    // Si ya tenemos cache del modelo auto, usarlo
    if (_spiderModelId) return _spiderModelId;

    // Auto-detectar: usar el primer modelo disponible
    const res = await fetch(`${SPIDER_IA_URL}/ia/models`, {
        headers: { 'X-API-KEY': process.env.SPIDER_API_KEY },
    });

    if (!res.ok) throw new Error(`SpiderIA /ia/models HTTP ${res.status}`);

    const data = await res.json();
    const models = data.models || data || [];
    if (!models.length) throw new Error('SpiderIA: no hay modelos disponibles');

    _spiderModelId = models[0].id;
    console.log(`🕷️  SpiderIA model (auto): ${_spiderModelId}`);
    return _spiderModelId;
}

/**
 * Llama a SpiderIA con soporte de tool-calling (multi-ronda).
 * Retorna { text, toolsMade } donde toolsMade es un array de {name, data}.
 */
async function callSpiderIA(messages) {
    console.log('🕷️  Intentando SpiderIA como proveedor principal...');
    const modelId = await getSpiderModel();
    const MAX_ROUNDS = 5;
    let currentMessages = [...messages];
    const toolsMade = []; // rastrear tools llamadas con sus resultados

    for (let round = 0; round < MAX_ROUNDS; round++) {
        debugLogMessages(`SpiderIA (ronda ${round + 1})`, currentMessages);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SPIDER_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(`${SPIDER_IA_URL}/ia/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SPIDER_API_KEY },
                body: JSON.stringify({ model_id: modelId, messages: currentMessages, tools: TOOLS, tool_choice: 'auto' }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) {
            let detail;
            try { detail = await res.json(); } catch (_) { detail = await res.text(); }
            console.error(`🕷️  SpiderIA HTTP ${res.status}:`, JSON.stringify(detail));
            throw new Error(`SpiderIA HTTP ${res.status}: ${JSON.stringify(detail)}`);
        }

        const rawBody = await res.text();
        let data;
        try { data = JSON.parse(rawBody); } catch (_) {
            console.error('🕷️  SpiderIA respondió con body no-JSON:', rawBody.slice(0, 300));
            throw new Error('SpiderIA respondió con body no-JSON');
        }

        const responseMsg = data.message || data.choices?.[0]?.message;
        const toolCalls = responseMsg?.tool_calls;

        if (toolCalls?.length > 0) {
            console.log(`🔧 [Tools] Ronda ${round + 1}: modelo quiere llamar ${toolCalls.length} tool(s): ${toolCalls.map(t => t.function?.name).join(', ')}`);

            currentMessages.push({
                role: 'assistant',
                content: responseMsg.content || null,
                tool_calls: toolCalls,
            });

            for (const tc of toolCalls) {
                let args = {};
                try { args = JSON.parse(tc.function?.arguments || '{}'); } catch (_) {}
                console.log(`🔧 [Tool] Ejecutando: ${tc.function?.name}(${JSON.stringify(args)})`);
                const result = await executeTool(tc.function?.name, args);
                console.log(`✅ [Tool] Resultado: ${result.slice(0, 120)}...`);

                // Guardar para richContent
                try {
                    toolsMade.push({ name: tc.function?.name, data: JSON.parse(result) });
                } catch (_) {
                    toolsMade.push({ name: tc.function?.name, data: result });
                }

                currentMessages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    name: tc.function?.name,
                    content: result,
                });
            }
        } else {
            const text = responseMsg?.content;
            if (!text) {
                console.error('🕷️  SpiderIA HTTP 200 pero sin contenido. Body:', JSON.stringify(data));
                throw new Error('SpiderIA respondió sin contenido útil');
            }
            console.log(`✅ SpiderIA OK (ronda ${round + 1}). Modelo: ${data.model || '?'} | Tokens: ${JSON.stringify(data.usage || {})}`);
            return { text, toolsMade };
        }
    }

    throw new Error(`SpiderIA excedió el límite de ${MAX_ROUNDS} rondas de tool calling`);
}

// ─── Mapa de temas → links del sitio ──────────────────────────────────────────
const TOPIC_LINKS = {
    carrera:        { icon: '📚', label: 'Ver info de la carrera, ver info de las materias, ver info de los titulos',          url: '/sabermas' },
    diplomaturas:   { icon: '🎓', label: 'Ver diplomaturas disponibles',     url: '/diplomaturas' },
    campus:         { icon: '🖥️',  label: 'Acceder al Campus Virtual',       url: 'https://aula.incuyo.edu.ar/', external: true },
    certificaciones:{ icon: '🏅', label: 'Ver certificaciones laborales',    url: '/#certificaciones' },
    proyectos:      { icon: '💡', label: 'Ver proyectos de alumnos o trabajos realizados por alumnos',         url: '/proyectosalumnos' },
    servicios:      { icon: '⚙️',  label: 'Ver servicios tecnológicos',      url: '/servicios' },
};

/**
 * Detecta los temas relevantes del mensaje del usuario.
 * Retorna un array de claves de TOPIC_LINKS, o null si no hay match.
 * @param {string} prompt
 * @returns {string[]|null}
 */
function detectChatIntent(prompt) {
    const p = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const topics = [];

    if (/materia|asignatura|plan.*estudio|que se estudia|que se ve|contenido|curriculum|carrera/.test(p))
        topics.push('carrera', 'certificaciones');

    if (/diplomatura|curso corto|capacitacion adicional|cursos que ofrecen/.test(p))
        topics.push('diplomaturas');

    if (/campus|aula virtual|plataforma|clase.*online|zoom|moodle/.test(p))
        topics.push('campus');

    if (/certificac|certificado|titulo intermedio|habilitante/.test(p))
        topics.push('certificaciones');

    if (/proyecto|que hacen.*alumno|sistema.*alumno|trabajo.*alumno|porfolio/.test(p))
        topics.push('proyectos');

    if (/servicio|empresa.*incuyo|tecnolog.*incuyo|contrat/.test(p))
        topics.push('servicios');

    // Deduplicar
    const unique = [...new Set(topics)];
    return unique.length > 0 ? unique : null;
}

/**
 * Genera HTML con botones/links hacia las páginas del sitio.
 * @param {string[]} topics - Claves de TOPIC_LINKS
 * @returns {string} HTML
 */
function generateLinksHtml(topics) {
    if (!topics?.length) return '';
    const btns = topics
        .filter(k => TOPIC_LINKS[k])
        .map(k => {
            const { icon, label, url, external } = TOPIC_LINKS[k];
            const target = external ? ' target="_blank" rel="noopener"' : '';
            return `<a href="${url}"${target} class="chat-link-btn">${icon} ${label}</a>`;
        });
    if (!btns.length) return '';
    return `<div class="chat-links-block"><div class="chat-links-title">🔗 Más información:</div><div class="chat-links-list">${btns.join('')}</div></div>`;
}

/**
 * Genera links HTML desde los resultados de tool calls del modelo.
 * Mapea el nombre de la tool a los topics correspondientes.
 * @param {Array<{name, data}>} toolsMade
 * @returns {string}
 */
function generateRichContent(toolsMade) {
    if (!toolsMade?.length) return '';
    const toolTopicMap = {
        get_materias_carrera: ['carrera', 'certificaciones'],
        get_materias_year:    ['carrera'],
        get_diplomaturas:     ['diplomaturas'],
    };
    const topics = [];
    toolsMade.forEach(({ name }) => {
        (toolTopicMap[name] || []).forEach(t => topics.push(t));
    });
    return generateLinksHtml([...new Set(topics)]);
}

/**
 * Genera links HTML a partir de la intención detectada del prompt.
 * No hace queries a la DB — solo genera botones de navegación.
 * @param {string[]|null} topics
 * @returns {string}
 */
function generateRichFromIntent(topics) {
    return generateLinksHtml(topics);
}


/**
 * Convierte un array de mensajes OpenAI-format al formato de Gemini y llama a la API.
 * El mensaje 'system' se pasa como system_instruction.
 * Los mensajes 'assistant' con contexto DB se convierten a rol 'model' de Gemini.
 * @param {Array} messages - Array [{role, content}]
 * @returns {string} Texto de respuesta
 */
async function callGemini(messages) {
    console.log('🔮 Usando Gemini como proveedor de respaldo...');
    debugLogMessages('Gemini', messages);

    const API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    if (!API_KEY) throw new Error('GEMINI_API_KEY no configurada en .env');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    // Separar system del resto
    const systemMsg = messages.find(m => m.role === 'system');
    const conversationMsgs = messages.filter(m => m.role !== 'system');

    // Convertir a formato Gemini [{role: 'user'|'model', parts: [{text}]}]
    const contents = conversationMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }],
    }));

    // Gemini requiere que la conversación empiece con un turno 'user'.
    // Si el primer mensaje es 'model' (contexto DB), lo fusionamos con el siguiente user.
    if (contents.length > 0 && contents[0].role === 'model') {
        const ctxText = contents[0].parts[0].text;
        if (contents[1] && contents[1].role === 'user') {
            // Prepend el contexto al primer mensaje del usuario
            contents[1].parts[0].text = `${ctxText}\n\n${contents[1].parts[0].text}`;
            contents.shift();
        }
    }

    const reqPayload = {
        system_instruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload),
    });

    console.log(`📡 Gemini HTTP: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        let errorDetails;
        try { errorDetails = await response.json(); } catch (_) { errorDetails = await response.text(); }
        throw new Error(`Gemini HTTP ${response.status}: ${JSON.stringify(errorDetails)}`);
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
        console.warn(`⚠️  Gemini bloqueó el prompt por: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini respondió 200 OK pero sin contenido útil');

    console.log('✅ Gemini OK.');
    return text;
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

        // 1. Mensajes base para SpiderIA (inyecta curriculum en primer mensaje)
        const baseMessages = await buildBaseMessages(history, prompt);
        console.log(`📨 Mensajes armados: ${baseMessages.length}`);

        let text = null;
        let provider = null;
        let spiderErr = null;
        let richContent = '';

        // 2. Intentar SpiderIA con tool-calling
        try {
            const result = await callSpiderIA(baseMessages);
            text = result.text;
            provider = 'SpiderIA';

            // Si el modelo llamó tools: richContent desde los resultados
            if (result.toolsMade?.length > 0) {
                richContent = generateRichContent(result.toolsMade);
                if (richContent) console.log(`🎨 [richContent] Generado desde tool calls (${richContent.length} chars)`);
            } else {
                // Modelo no llamó tools (normal en modelos pequeños sin soporte de function calling).
                // Detectar intención del prompt y generar richContent directamente.
                const intent = detectChatIntent(prompt);
                if (intent) {
                    console.log(`🔍 [Intent] Detectado: [${intent.join(', ')}] — generando links...`);
                    richContent = generateRichFromIntent(intent);
                    if (richContent) console.log(`🎨 [richContent] Generado desde intención (${richContent.length} chars)`);
                }
            }
        } catch (err) {
            spiderErr = err;
            const isTimeout = err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('abort');
            const isNetwork = err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND') || err.message.includes('fetch failed');
            const failType = isTimeout ? '⏱️ TIMEOUT' : isNetwork ? '🔌 RED/CONEXIÓN' : '❌ HTTP/RESPUESTA';
            console.warn(`⚠️  SpiderIA falló [${failType}]: ${err.message} — activando fallback a Gemini.`);
            if (isNetwork || isTimeout) _spiderModelId = null;
        }

        // 3. Fallback a Gemini (con contexto DB pre-cargado)
        if (text === null) {
            try {
                console.log('📦 [Gemini fallback] Cargando contexto DB...');
                const dbContext = await buildDbContext();
                const geminiMessages = buildMessagesWithContext(history, prompt, dbContext);
                text = await callGemini(geminiMessages);
                provider = 'Gemini (fallback)';
            } catch (geminiErr) {
                console.error('❌ Gemini también falló:', geminiErr.message);
                return res.status(500).json({
                    error: 'Ambos proveedores de IA fallaron.',
                    details: { spiderIA: spiderErr?.message, gemini: geminiErr.message },
                });
            }
        }

        console.log(`✅ Respuesta generada por: ${provider}`);
        console.log('--- FIN CONSULTA IA ---\n');
        res.json({ response: text, richContent: richContent || undefined });

    } catch (err) {
        console.error('❌ ERROR CRÍTICO procesando chat en servidor:', err);
        res.status(500).json({ error: 'Error al procesar la consulta', details: err.message });
    }
}

module.exports = { handleChat, invalidateDbContextCache, setPreferredModel, getPreferredModel };
