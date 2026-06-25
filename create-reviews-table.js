/**
 * Script para crear la tabla student_reviews en la base de datos SpiderWeb
 * Ejecutar con: node create-reviews-table.js
 */
require('dotenv').config();
const { query } = require('./lib/spider');

async function main() {
    console.log('🔧 Creando tabla student_reviews...');
    try {
        // Intentar con ENUM primero
        await query(`CREATE TABLE IF NOT EXISTS student_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_name VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            photo_url TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at DATETIME DEFAULT NOW()
        )`);
        console.log('✅ Tabla student_reviews creada correctamente.');
    } catch (err) {
        console.error('❌ Error creando tabla:', err.message);
        process.exit(1);
    }
}

main();
