/**
 * hooks/useShareLink.ts — Validates a share-link token on mount.
 * Used by the unauthenticated share link screen (app/share/[token].tsx).
 */

import { useEffect, useState } from 'react';
import type { ShareLink } from '@/contracts/types';
import { validateShareLink } from '@/lib/shareLinks';

export interface ShareLinkState {
  shareLink: ShareLink | null;
  isValid: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useShareLink(token: string | null): ShareLinkState {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setShareLink(null);
      setIsValid(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const link = await validateShareLink(token);
        if (cancelled) return;

        setShareLink(link);
        setIsValid(true);
      } catch (e) {
        if (!cancelled) {
          setShareLink(null);
          setIsValid(false);
          setError(e instanceof Error ? e.message : 'Invalid share link');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return { shareLink, isValid, isLoading, error };
}
