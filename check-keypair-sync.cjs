require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function checkAndReportKeys() {
  try {
    await client.connect();
    
    console.log('\n=== DATABASE PUBLIC KEYS ===\n');
    
    const result = await client.query(
      'SELECT id, username, public_key FROM users WHERE id IN (16, 17) ORDER BY id'
    );
    
    result.rows.forEach(row => {
      console.log(`User ${row.id} (${row.username}):`);
      console.log(`  Stored in DB: ${row.public_key ? row.public_key.substring(0, 50) : 'NULL'}`);
      console.log(`  Length: ${row.public_key?.length || 0}`);
    });
    
    console.log('\n=== NEXT STEPS ===\n');
    console.log('1. Open BOTH browser windows');
    console.log('2. testacc1 (LEFT): Open DevTools → Console');
    console.log('3. Run: JSON.parse(localStorage.getItem(\"user_keypair_16\")).publicKey');
    console.log('4. testacc2 (RIGHT): Open DevTools → Console');
    console.log('5. Run: JSON.parse(localStorage.getItem(\"user_keypair_17\")).publicKey');
    console.log('6. COMPARE the values above with DB values');
    console.log('7. If they DON\'T match → we need to fix sync\n');
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await client.end();
  }
}

checkAndReportKeys();
