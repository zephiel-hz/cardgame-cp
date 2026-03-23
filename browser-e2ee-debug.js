// Run this in browser console to verify E2EE keypair integrity

const userId = parseInt(prompt('Enter your user ID (16 or 17):', '16'));
const keypair = JSON.parse(localStorage.getItem(`user_keypair_${userId}`));

if (!keypair) {
  console.log('❌ No keypair found in localStorage for user', userId);
} else {
  console.log('📋 Keypair Info:');
  console.log('  Public Key (first 30 chars):', keypair.publicKey?.substring(0, 30));
  console.log('  Public Key length:', keypair.publicKey?.length);
  console.log('  Secret Key (first 30 chars):', keypair.secretKey?.substring(0, 30));
  console.log('  Secret Key length:', keypair.secretKey?.length);
  
  // Verify keys are base64 and valid
  try {
    const basePat = /^[A-Za-z0-9+/]*={0,2}$/;
    if (basePat.test(keypair.publicKey) && basePat.test(keypair.secretKey)) {
      console.log('✓ Both keys look like valid base64');
    } else {
      console.log('❌ Keys do not look like base64');
    }
  } catch (e) {
    console.log('❌ Error validating keys:', e.message);
  }
}

// Also show what's in the API for this user
const partnerId = userId === 16 ? 17 : 16;
fetch(`/api/auth/public-key/${partnerId}`)
  .then(r => r.json())
  .then(data => {
    console.log(`\n📡 Partner ${partnerId} public key from server:`);
    console.log('  Key (first 30 chars):', data.publicKey?.substring(0, 30));
    console.log('  Key length:', data.publicKey?.length);
  })
  .catch(e => console.log('❌ Error fetching partner key:', e.message));
