require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function resetE2EEKeys() {
  try {
    await client.connect();
    
    console.log('\n=== RESETTING E2EE KEYS ===\n');
    
    // Reset both users' public keys
    for (const userId of [16, 17]) {
      const result = await client.query(
        'UPDATE users SET public_key = NULL WHERE id = $1 RETURNING id, username',
        [userId]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log(`✓ Reset E2EE key for user ${user.id} (${user.username})`);
      } else {
        console.log(`✗ User ${userId} not found`);
      }
    }
    
    console.log('\n✓ RESET COMPLETE');
    console.log('\nNext steps:');
    console.log('1. Both users should log out completely');
    console.log('2. Clear localStorage: Open DevTools → Application → Storage → Clear All');
    console.log('3. Log back in - new keypairs will be generated automatically');
    console.log('4. Send new messages - they will encrypt/decrypt properly');
    console.log('5. Old messages will show as plaintext (backward compatible)\n');
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await client.end();
  }
}

resetE2EEKeys();
