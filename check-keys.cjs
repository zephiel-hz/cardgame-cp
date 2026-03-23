require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    return client.query(
      'SELECT id, username, LENGTH(public_key) as pk_len, public_key FROM users WHERE id IN (16, 17)'
    );
  })
  .then(res => {
    console.log('\n=== USER PUBLIC KEYS ===\n');
    res.rows.forEach(row => {
      console.log(`User ${row.id} (${row.username})`);
      console.log(`  Key Length: ${row.pk_len} bytes`);
      console.log(`  First 50 chars: ${row.public_key ? row.public_key.substring(0, 50) : 'NULL'}`);
      console.log('');
    });
  })
  .catch(e => console.error('ERROR:', e.message))
  .finally(() => {
    client.end();
  });
