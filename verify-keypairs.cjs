require('dotenv').config({ path: '.env.local' });
const nacl = require('tweetnacl');
const { toUint8Array, fromUint8Array } = require('js-base64');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => {
    return client.query(
      'SELECT id, username, public_key FROM users WHERE id IN (16, 17)'
    );
  })
  .then(res => {
    console.log('\n=== PUBLIC KEY VERIFICATION ===\n');
    
    const users = {};
    res.rows.forEach(row => {
      users[row.id] = { username: row.username, publicKey: row.public_key };
    });
    
    // Display keys
    Object.entries(users).forEach(([id, user]) => {
      console.log(`User ${id} (${user.username}):`);
      console.log(`  Public Key (base64): ${user.publicKey}`);
      
      // Try to decode and verify it's a valid NaCl key
      try {
        const keyBytes = toUint8Array(user.publicKey);
        console.log(`  Decoded length: ${keyBytes.length} bytes (should be 32)`);
        console.log(`  First 8 bytes (hex): ${Array.from(keyBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      } catch (e) {
        console.log(`  ❌ ERROR decoding: ${e.message}`);
      }
      console.log('');
    });
    
    // Show what was stored
    console.log('=== LATEST MESSAGES ===\n');
    return client.query(
      `SELECT id, sender_id, recipient_id, LENGTH(content) as len, SUBSTRING(content, 1, 100) as content_preview
       FROM messages 
       WHERE sender_id IN (16, 17) AND recipient_id IN (16, 17)
       ORDER BY id DESC 
       LIMIT 5`
    );
  })
  .then(res => {
    res.rows.forEach(row => {
      const isEncrypted = row.len > 50;
      console.log(
        `[${row.id}] ${row.sender_id}→${row.recipient_id} | len:${row.len} | ${isEncrypted ? '🔒' : '📄'} | ${row.content_preview}`
      );
    });
  })
  .catch(e => console.error('ERROR:', e.message))
  .finally(() => client.end());
