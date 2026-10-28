/**
 * Script para crear la tabla company_contacts en SpiderWeb DB
 * Ejecutar con: node create-company-contacts-table.js
 */
require('dotenv').config();
const { query } = require('./lib/spider');

async function main() {
    console.log('🔧 Creando tabla company_contacts...');
    try {
        await query(`CREATE TABLE IF NOT EXISTS company_contacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            contact_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(100),
            service_type VARCHAR(100) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(30) DEFAULT 'pending',
            notes TEXT,
            created_at DATETIME DEFAULT NOW()
        )`);
        console.log('✅ Tabla company_contacts creada correctamente.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creando tabla company_contacts:', err.message);
        process.exit(1);
    }
}

main();
