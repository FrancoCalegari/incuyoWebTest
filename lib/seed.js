/**
 * Database Seed Script — Creates tables and inserts initial data
 * Run: npm run seed
 */
require('dotenv').config();
const { query } = require('./spider');

async function seed() {
    console.log('🌱 Seeding database...\n');

    // ─── Create Tables ───────────────────────────────────
    console.log('📦 Creating tables...');

    await query(`
		CREATE TABLE IF NOT EXISTS curriculum (
			id INT AUTO_INCREMENT PRIMARY KEY,
			year INT NOT NULL,
			subject_name VARCHAR(255) NOT NULL,
			order_index INT DEFAULT 0
		)
	`);
    console.log('  ✅ curriculum');

    await query(`
		CREATE TABLE IF NOT EXISTS social_commitment (
			id INT AUTO_INCREMENT PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			image_url TEXT,
			order_index INT DEFAULT 0
		)
	`);
    console.log('  ✅ social_commitment');

    await query(`
		CREATE TABLE IF NOT EXISTS student_projects (
			id INT AUTO_INCREMENT PRIMARY KEY,
			student_name VARCHAR(255) NOT NULL,
			student_photo_url TEXT,
			year INT NOT NULL,
			project_name VARCHAR(255) NOT NULL,
			project_icon VARCHAR(100) DEFAULT 'fas fa-code',
			project_description TEXT,
			project_image_url TEXT,
			project_demo_url TEXT,
			tech_tags TEXT,
			order_index INT DEFAULT 0
		)
	`);
    console.log('  ✅ student_projects');

    // ─── Seed Curriculum ─────────────────────────────────
    console.log('\n📚 Seeding curriculum...');

    // Check if data already exists
    const existing = await query('SELECT COUNT(*) as count FROM curriculum');
    const count = existing?.results?.[0]?.count || existing?.[0]?.count || 0;

    if (count > 0) {
        console.log('  ⏩ Curriculum data already exists, skipping...');
    } else {
        const subjects = [
            // 1° Año
            { year: 1, name: 'Programación 1 + IA', order: 1 },
            { year: 1, name: 'Matemática aplicada', order: 2 },
            { year: 1, name: 'Lógica computacional', order: 3 },
            { year: 1, name: 'Inglés técnico 1', order: 4 },
            { year: 1, name: 'Alfabetización académica', order: 5 },
            { year: 1, name: 'Seminario de nuevas tecnologías + IA', order: 6 },
            { year: 1, name: 'Arquitectura de dispositivos', order: 7 },
            { year: 1, name: 'Sistemas operativos 1', order: 8 },
            { year: 1, name: 'Base de datos 1', order: 9 },
            { year: 1, name: 'Práctica Profesionalizante 1 + IA', order: 10 },
            // 2° Año
            { year: 2, name: 'Programación 2 + IA', order: 1 },
            { year: 2, name: 'Matemática discreta', order: 2 },
            { year: 2, name: 'Comunicación y redes', order: 3 },
            { year: 2, name: 'Inglés técnico 2', order: 4 },
            { year: 2, name: 'Modelado de software + IA', order: 5 },
            { year: 2, name: 'Sistemas Operativos 2', order: 6 },
            { year: 2, name: 'Base de datos 2 + IA', order: 7 },
            { year: 2, name: 'Práctica Profesionalizante 2 + IA', order: 8 },
            // 3° Año
            { year: 3, name: 'Programación 3 + IA', order: 1 },
            { year: 3, name: 'Arquitectura y diseño de interfaces: UI y UX + IA', order: 2 },
            { year: 3, name: 'Auditoría y calidad de sistemas', order: 3 },
            { year: 3, name: 'Ciberseguridad + IA', order: 4 },
            { year: 3, name: 'Inglés técnico 3', order: 5 },
            { year: 3, name: 'Legislación informática y ética profesional', order: 6 },
            { year: 3, name: 'Estadística y probabilidades para el desarrollo de software', order: 7 },
            { year: 3, name: 'Gestión de proyectos de software', order: 8 },
            { year: 3, name: 'Metodologías ágiles + IA', order: 9 },
            { year: 3, name: 'Base de datos 3 + IA', order: 10 },
            { year: 3, name: 'Práctica Profesionalizante 3 + IA', order: 11 },
        ];

        for (const s of subjects) {
            await query(`INSERT INTO curriculum (year, subject_name, order_index) VALUES (${s.year}, ?, ${s.order})`, [s.name]);
        }
        console.log(`  ✅ Inserted ${subjects.length} subjects`);
    }

    // ─── Seed Social Commitment ──────────────────────────
    console.log('\n🤝 Seeding social commitment...');

    const existingSC = await query('SELECT COUNT(*) as count FROM social_commitment');
    const countSC = existingSC?.results?.[0]?.count || existingSC?.[0]?.count || 0;

    if (countSC > 0) {
        console.log('  ⏩ Social commitment data already exists, skipping...');
    } else {
        const commitments = [
            {
                title: 'Apoyo a comedores comunitarios',
                description: 'Los alumnos organizan actividades para colaborar con comedores comunitarios de la zona.',
                image_url: 'https://incuyo.edu.ar/wp-content/uploads/2024/04/comedor1-768x432.jpeg',
                order: 1,
            },
            {
                title: 'Trabajo en equipo por la comunidad',
                description: 'Actividades solidarias donde los estudiantes trabajan juntos para ayudar a los más necesitados.',
                image_url: 'https://incuyo.edu.ar/wp-content/uploads/2024/04/comedor-2-576x1024.jpeg',
                order: 2,
            },
        ];

        for (const c of commitments) {
            await query(
                `INSERT INTO social_commitment (title, description, image_url, order_index) VALUES (?, ?, ?, ${c.order})`,
                [c.title, c.description, c.image_url]
            );
        }
        console.log(`  ✅ Inserted ${commitments.length} commitments`);
    }

    // ─── Seed Student Projects ───────────────────────────
    console.log('\n💻 Seeding student projects...');

    const existingSP = await query('SELECT COUNT(*) as count FROM student_projects');
    const countSP = existingSP?.results?.[0]?.count || existingSP?.[0]?.count || 0;

    if (countSP > 0) {
        console.log('  ⏩ Student projects data already exists, skipping...');
    } else {
        const projects = [
            {
                student_name: 'Franco Calegari',
                student_photo_url: '/assets/img/franco.png',
                year: 2,
                project_name: 'Spider Web Test',
                project_icon: 'fas fa-spider',
                project_description: 'Aplicación web interactiva desarrollada con tecnologías modernas. Este proyecto demuestra habilidades avanzadas en desarrollo frontend, con un diseño responsive y animaciones fluidas. Incluye funcionalidades dinámicas y una excelente experiencia de usuario.',
                project_image_url: '/assets/img/spiderweb.png',
                project_demo_url: 'https://spider-web-test.vercel.app/',
                tech_tags: JSON.stringify(['node.js', 'JavaScript', 'CSS3', 'API Integration']),
                order: 1,
            },
            {
                student_name: 'Gabriel Reina',
                student_photo_url: '/assets/img/gabo.png',
                year: 1,
                project_name: 'Tartas Odi',
                project_icon: 'fas fa-birthday-cake',
                project_description: 'Sitio web completo para una pastelería artesanal, desarrollado por un alumno de primer año. Incluye catálogo de productos, sistema de pedidos y diseño atractivo. Demuestra excelente comprensión de diseño web y programación básica, creando una solución funcional para un negocio real.',
                project_image_url: '/assets/img/tartasOdi.png',
                project_demo_url: 'https://tartas-odi.vercel.app/',
                tech_tags: JSON.stringify(['HTML5', 'CSS3', 'JavaScript', 'Responsive']),
                order: 2,
            },
        ];

        for (const p of projects) {
            await query(
                `INSERT INTO student_projects (student_name, student_photo_url, year, project_name, project_icon, project_description, project_image_url, project_demo_url, tech_tags, order_index) VALUES (?, ?, ${p.year}, ?, ?, ?, ?, ?, ?, ${p.order})`,
                [p.student_name, p.student_photo_url, p.project_name, p.project_icon, p.project_description, p.project_image_url, p.project_demo_url, p.tech_tags]
            );
        }
        console.log(`  ✅ Inserted ${projects.length} projects`);
    }

    console.log('\n🎉 Seed completed successfully!');
}

seed().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
