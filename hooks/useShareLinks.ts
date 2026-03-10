/**
 * hooks/useShareLinks.ts — Manage share links for a group.
 * Fetches, generates, and revokes share links.
 * [VCH-48]
 */

import { useCallback, useEffect, useState } from 'react';
import type { ShareLink } from '@/contracts/types';
import {
  generateShareLink,
  getShareLinksForGroup,
  revokeShareLink,
} from '@/lib/shareLinks';

export interface ShareLinksState {
  links: ShareLink[];
  isLoading: boolean;
  error: string | null;
  generate: (expiresAt?: string) => Promise<void>;
  revoke: (linkId: string) => Promise<void>;
}

export function useShareLinks(groupId: string | null): ShareLinksState {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLinks([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fetched = await getShareLinksForGroup(groupId);
        if (cancelled) return;

        setLinks(fetched);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load share links',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const generate = useCallback(
    async (expiresAt?: string): Promise<void> => {
      if (!groupId) return;
      try {
        setError(null);
        await generateShareLink(groupId, expiresAt);
        const refreshed = await getShareLinksForGroup(groupId);
        setLinks(refreshed);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'Failed to generate share link';
        setError(msg);
        throw e;
      }
    },
    [groupId],
  );

  const revoke = useCallback(
    async (linkId: string): Promise<void> => {
      if (!groupId) return;
      try {
        setError(null);
        await revokeShareLink(linkId);
        const refreshed = await getShareLinksForGroup(groupId);
        setLinks(refreshed);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'Failed to revoke share link';
        setError(msg);
        throw e;
      }
    },
    [groupId],
  );

  return { links, isLoading, error, generate, revoke };
}
