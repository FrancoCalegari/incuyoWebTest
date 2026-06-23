require('dotenv').config();
const { query } = require('./lib/spider.js');

async function alter() {
    try {
        await query(`ALTER TABLE scholarship_applications ADD COLUMN age INT`).catch(e => console.log('Age already exists or err', e.message));
        await query(`ALTER TABLE scholarship_applications ADD COLUMN high_school_finished TINYINT(1)`).catch(e => console.log('HS finished already exists or err', e.message));
        await query(`ALTER TABLE scholarship_applications ADD COLUMN preferred_shifts VARCHAR(255)`).catch(e => console.log('Shifts already exists or err', e.message));
        console.log("Table altered successfully.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

alter();
