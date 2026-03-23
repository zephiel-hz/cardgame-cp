import nacl from 'tweetnacl';
import { toUint8Array, fromUint8Array } from 'js-base64';

/**
 * End-to-End Encryption utilities for chat using NaCl (TweetNaCl)
 * 
 * Architecture: Symmetric encryption with ECDH key exchange
 * - Derive shared secret from both public keys (ECDH)
 * - Use shared secret for symmetric encryption (XSalsa20-Poly1305)
 * - Result: Both users can encrypt/decrypt, server cannot
 * 
 * Cross-Device Support: Keypair derived from password (deterministic)
 * - Same password = same keypair on all devices
 * - Enables message decryption across devices/browsers
 */

// Generate a keypair for a user
export function generateKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: fromUint8Array(keyPair.publicKey), // Base64 string
    secretKey: fromUint8Array(keyPair.secretKey), // Base64 string - KEEP SECRET
  };
}

// Derive keypair deterministically from password + userId
// This ensures same keypair on all devices for same user/password
export async function deriveKeypairFromPassword(
  password: string,
  userId: number
): Promise<{ publicKey: string; secretKey: string }> {
  // Combine password + userId as seed material
  const seed = `${password}:${userId}`;
  
  // Use SHA-256 to hash into 32-byte deterministic seed
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const secretKeyBytes = new Uint8Array(hashBuffer);
  
  // Derive keypair from secret key
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKeyBytes);
  
  return {
    publicKey: fromUint8Array(keyPair.publicKey),
    secretKey: fromUint8Array(keyPair.secretKey),
  };
}

// Derive shared secret from both public keys using ECDH
export function deriveSharedSecret(
  userPublicKey: string,
  partnerPublicKey: string,
  userSecretKey: string
): Uint8Array {
  const userPubKeyBytes = toUint8Array(userPublicKey);
  const partnerPubKeyBytes = toUint8Array(partnerPublicKey);
  const userSecKeyBytes = toUint8Array(userSecretKey);
  
  // Use NaCl's ECDH to compute shared secret
  // This produces a 32-byte key suitable for XSalsa20
  const sharedSecret = nacl.scalarMult(userSecKeyBytes, partnerPubKeyBytes);
  
  console.log('[E2EE] ✓ Shared secret derived, length:', sharedSecret.length);
  return sharedSecret;
}

// Encrypt a message using shared secret (symmetric encryption)
export function encryptMessage(
  plaintext: string,
  userPublicKey: string,
  partnerPublicKey: string,
  userSecretKey: string
): string {
  try {
    const message = new TextEncoder().encode(plaintext);
    const nonce = nacl.randomBytes(24); // 24-byte nonce for XSalsa20
    
    // Derive shared secret
    const sharedSecret = deriveSharedSecret(userPublicKey, partnerPublicKey, userSecretKey);
    
    // Encrypt using symmetric encryption with shared secret
    const encrypted = nacl.secretbox(message, nonce, sharedSecret);
    
    // Combine nonce + encrypted message and encode as base64
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    
    const ciphertext = fromUint8Array(combined);
    console.log('[Encrypt] ✓ Plaintext length:', plaintext.length, '→ Ciphertext length:', ciphertext.length);
    return ciphertext;
  } catch (err) {
    console.error('[Encrypt] Error:', err);
    throw new Error(`Encryption failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Decrypt a message using shared secret (symmetric decryption)
export function decryptMessage(
  ciphertext: string,
  userPublicKey: string,
  partnerPublicKey: string,
  userSecretKey: string
): string {
  try {
    const combined = toUint8Array(ciphertext);
    const nonce = combined.slice(0, 24);
    const encrypted = combined.slice(24);
    
    // Derive shared secret
    const sharedSecret = deriveSharedSecret(userPublicKey, partnerPublicKey, userSecretKey);
    
    console.log('[Decrypt] Nonce length:', nonce.length, '(should be 24)');
    console.log('[Decrypt] Encrypted data length:', encrypted.length);
    
    const decrypted = nacl.secretbox.open(encrypted, nonce, sharedSecret);
    
    if (!decrypted) {
      throw new Error('Decryption failed: invalid signature or corrupted data');
    }
    
    const plaintext = new TextDecoder().decode(decrypted);
    console.log('[Decrypt] ✓ Success, decrypted length:', plaintext.length);
    return plaintext;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Decrypt] Error:', errorMsg);
    throw new Error(`Failed to decrypt message: ${errorMsg}`);
  }
}

// Store keypair in localStorage (client-side only)
export function storeKeyPair(userId: number, keyPair: { publicKey: string; secretKey: string }) {
  const key = `user_keypair_${userId}`;
  localStorage.setItem(key, JSON.stringify(keyPair));
}

// Retrieve keypair from localStorage
export function getStoredKeyPair(userId: number): { publicKey: string; secretKey: string } | null {
  const key = `user_keypair_${userId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

// Check if user has a keypair stored locally
export function hasStoredKeyPair(userId: number): boolean {
  const key = `user_keypair_${userId}`;
  return localStorage.getItem(key) !== null;
}

// Force regenerate keypair on next login
export function forceRegenerateKeyPair(userId: number): void {
  const key = `user_keypair_${userId}`;
  localStorage.removeItem(key);
  localStorage.setItem('e2ee_force_regen', 'true');
  console.log(`[E2EE] Marked keypair for force regeneration on next login for user ${userId}`);
}
