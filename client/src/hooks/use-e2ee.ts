import { useEffect, useState } from 'react';
import { useToast } from './use-toast';
import { useAuth } from '@/lib/auth-context';
import { deriveKeypairFromPassword, storeKeyPair } from '@shared/crypto-utils';

interface UseE2EEProps {
  userId: number | null;
  enabled?: boolean;
}

export function useE2EE({ userId, enabled = true }: UseE2EEProps) {
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!userId || !enabled) return;

    const setupE2EE = async () => {
      try {
        setIsLoading(true);

        // Get PIN from multiple sources:
        // 1. First try sessionStorage (set during login)
        let pin = sessionStorage.getItem('e2ee_login_pin');
        
        // 2. If not in sessionStorage, try getting from user object in localStorage
        if (!pin && user?.pin) {
          console.log('[E2EE] PIN found in user object, using that');
          pin = user.pin;
        }

        if (!pin) {
          console.warn('[E2EE] ❌ PIN not found anywhere - E2EE cannot derive keypair');
          throw new Error('Login PIN not found - cannot setup E2EE');
        }

        // Always derive keypair from PIN (deterministic across all devices)
        // This way, same PIN = same keypair on all devices = can decrypt old messages
        console.log('[E2EE] Deriving keypair from PIN for userId:', userId);
        const keyPair = await deriveKeypairFromPassword(pin, userId);
        console.log('[E2EE] ✓ Keypair derived from PIN, public key length:', keyPair.publicKey.length);

        // Store derived keypair locally for faster access
        storeKeyPair(userId, keyPair);
        console.log('[E2EE] ✓ Keypair stored in localStorage');

        // ALWAYS send public key to server (in case it wasn't saved before)
        console.log('[E2EE SETUP] Sending public key to server...');
        console.log('[E2EE SETUP] Public key value:', keyPair.publicKey.substring(0, 30) + '...');
        console.log('[E2EE SETUP] Public key length:', keyPair.publicKey.length);
        
        const response = await fetch('/api/auth/setup-e2ee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            publicKey: keyPair.publicKey,
          }),
        });

        console.log('[E2EE SETUP] Response status:', response.status);
        console.log('[E2EE SETUP] Response ok:', response.ok);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Server error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        console.log('[E2EE] ✓ Setup complete - Public key sent to server');
        setIsSetup(true);

        toast({
          title: 'E2EE Enabled',
          description: 'End-to-end encryption is now active - messages synced across devices',
        });
      } catch (error) {
        console.error('[E2EE] Setup error:', error);
        toast({
          title: 'E2EE Setup Error',
          description: error instanceof Error ? error.message : 'Failed to setup encryption',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    setupE2EE();
  }, [userId, enabled, toast, user?.pin]);

  return { isSetup, isLoading };
}
