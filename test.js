require('dotenv').config();
const { query, uploadFile } = require('./lib/spider');

async function run() {
    console.log('📤 Uploading test image...');

    // Simulate upload
    const result = await uploadFile(Buffer.from('fake-image-data'), 'test-image.jpg', 'image/jpeg');
    console.log('✅ Upload result:', result);
    console.log('   URL:', result.url);

    // Now try to UPDATE using that URL as a parameter (like the admin panel does)
    const testId = 1; // won't matter, will fail gracefully if row doesn't exist
    console.log('\n🔄 Testing SQL UPDATE with URL as parameter...');
    try {
        await query(
            `UPDATE student_projects SET student_photo_url=?, project_image_url=? WHERE id=${testId}`,
            [result.url, result.url]
        );
        console.log('✅ SQL update succeeded');
    } catch (e) {
        // Expected if id=1 doesn't exist, but the SQL should not be CORRUPTED
        if (e.message.includes('does not exist') || e.message.includes('no rows') || e.message.includes('affected')) {
            console.log('✅ SQL was not corrupted (row just does not exist)');
        } else {
            console.error('❌ SQL was corrupted:', e.message);
        }
    }
}

run().catch(console.error);
