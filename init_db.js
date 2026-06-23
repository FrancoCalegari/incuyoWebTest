require('dotenv').config();
const { query } = require('./lib/spider.js');

async function init() {
    try {
        await query(`CREATE TABLE IF NOT EXISTS scholarship_applications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(255),
            reason TEXT,
            status ENUM('pending', 'reviewed') DEFAULT 'pending',
            created_at DATETIME DEFAULT NOW()
        )`);
        console.log("Table scholarship_applications created successfully.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

init();
