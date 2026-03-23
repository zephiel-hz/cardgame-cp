require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function clearOldMessages() {
  try {
    await client.connect();
    
    console.log('\n=== CLEARING OLD ENCRYPTED MESSAGES ===\n');
    
    // Delete all messages between users 16 and 17
    const result = await client.query(
      `DELETE FROM messages 
       WHERE (sender_id = 16 AND recipient_id = 17) 
          OR (sender_id = 17 AND recipient_id = 16)`
    );
    
    console.log(`✓ Deleted ${result.rowCount} old messages`);
    console.log('\n✓ READY FOR FRESH E2EE TESTING');
    console.log('\nNext steps:');
    console.log('1. Both users: Open DevTools → Application → Local Storage');
    console.log('2. Delete ALL keys including message_plaintext_* entries');
    console.log('3. Refresh page - should be logged in with new keys');
    console.log('4. Send new messages - they will be encrypted/decrypted properly\n');
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await client.end();
  }
}

clearOldMessages();
