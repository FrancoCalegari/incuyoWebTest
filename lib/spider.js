/**
 * Spider API Helper — SQL Database & Cloud Storage
 */
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const API_URL = process.env.SPIDER_API_URL;
const API_KEY = process.env.SPIDER_API_KEY;
const DB_NAME = process.env.SPIDER_DB_NAME;

const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY,
};

// ─── SQL ─────────────────────────────────────────────
async function query(sql, params = []) {
    let processedSQL = sql;
    try {
        // Replace ? placeholders one at a time, advancing position after each
        // to avoid matching ? characters inside already-substituted values (e.g. URLs)
        let searchFrom = 0;
        params.forEach((param) => {
            const value = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param ?? '');
            const idx = processedSQL.indexOf('?', searchFrom);
            if (idx !== -1) {
                processedSQL = processedSQL.slice(0, idx) + value + processedSQL.slice(idx + 1);
                searchFrom = idx + value.length; // skip past inserted value
            }
        });

        const res = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ database: DB_NAME, query: processedSQL }),
        });

        const data = await res.json();
        if (data.error) {
            console.error('\n❌ Spider SQL Error:', data.error);
            console.error('📝 Failed Query:', processedSQL);
            throw new Error(data.error);
        }
        return data;
    } catch (err) {
        console.error('\n❌ Spider query failed:', err.message);
        console.error('📝 Failed Query:', processedSQL);
        throw err;
    }
}

// ─── Cloud Storage ───────────────────────────────────
async function getStorageProjectId() {
    const projectName = process.env.SPIDER_CLOUD_PROJECT;
    const res = await fetch(`${API_URL}/storage/projects`, { headers: { 'X-API-KEY': API_KEY } });
    const data = await res.json();

    const project = (data.projects || data || []).find(
        (p) => p.name === projectName || p.id === projectName
    );

    if (project) return project.id;

    // Create the project if it doesn't exist
    const createRes = await fetch(`${API_URL}/storage/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: projectName }),
    });
    const created = await createRes.json();
    return created.id || created.project?.id;
}

async function uploadFile(fileBuffer, filename, mimetype) {
    const projectId = await getStorageProjectId();

    const form = new FormData();
    form.append('files', fileBuffer, { filename, contentType: mimetype });

    const res = await fetch(`${API_URL}/storage/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY, ...form.getHeaders() },
        body: form,
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Return the file URL or info
    const file = data.files?.[0] || data[0] || data;
    return {
        id: file.id,
        url: `${API_URL}/storage/files/${file.id}?api_key=${API_KEY}`,
        name: file.original_name || file.name || filename,
    };
}

async function deleteFile(fileId) {
    const res = await fetch(`${API_URL}/storage/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': API_KEY },
    });
    return res.json();
}

async function getFileUrl(fileId) {
    return `${API_URL}/storage/files/${fileId}?api_key=${API_KEY}`;
}

module.exports = { query, uploadFile, deleteFile, getFileUrl, getStorageProjectId };
