/**
 * hooks/useJoinGroup.ts — Joins a group via share-link token.
 * Used by app/(app)/groups/join.tsx.
 */

import { useCallback, useState } from 'react';
import { joinGroupByInviteLink } from '@/lib/groups';

export interface JoinGroupState {
  join: (token: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useJoinGroup(): JoinGroupState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (token: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await joinGroupByInviteLink(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to join group';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { join, isLoading, error };
}
