/**
 * hooks/useSharedCalendar.ts — Read-only event list via share-link token.
 * Fetches events using getSharedEvents and clears the token on cleanup.
 * [VCH-54]
 */

import { useEffect, useState } from 'react';
import type { EventWithMeta } from '@/contracts/types';
import { clearShareToken, getSharedEvents } from '@/lib/sharedCalendar';

export interface SharedCalendarState {
  events: EventWithMeta[];
  isLoading: boolean;
  error: string | null;
}

export function useSharedCalendar(token: string | null): SharedCalendarState {
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setEvents([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fetched = await getSharedEvents(token);
        if (cancelled) return;

        setEvents(fetched);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load shared calendar',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearShareToken();
    };
  }, [token]);

  return { events, isLoading, error };
}
