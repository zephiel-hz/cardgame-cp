require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect().then(() => {
  const query = `
    SELECT id, sender_id, recipient_id, LENGTH(content) as len, content, created_at
    FROM messages 
    WHERE sender_id IN (16,17) OR recipient_id IN (16,17) 
    ORDER BY id DESC 
    LIMIT 10
  `;
  
  return client.query(query);
}).then(res => {
  console.log('\n=== MESSAGE ENCRYPTION STATUS ===\n');
  res.rows.forEach(row => {
    const isLikelyEncrypted = row.len > 50;
    const marker = isLikelyEncrypted ? '🔒' : '📄';
    const content = row.content.substring(0, 70);
    console.log(`[${row.id}] ${row.sender_id}→${row.recipient_id} | len:${row.len} | ${marker} | ${content}`);
  });
  console.log('');
}).catch(err => {
  console.error('ERROR:', err.message);
}).finally(() => {
  client.end();
});
