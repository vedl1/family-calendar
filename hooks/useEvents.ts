/**
 * hooks/useEvents.ts — Event state and actions for a group's calendar.
 * Fetches events for the current calendar month, subscribes to realtime
 * updates, and provides optimistic RSVP mutations.
 * [VCH-46]
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Event,
  EventWithMeta,
  Importance,
  RSVPStatus,
} from '@/contracts/types';
import { useAuth } from '@/hooks/useAuth';
import {
  createEvent as libCreateEvent,
  updateEvent as libUpdateEvent,
  deleteEvent as libDeleteEvent,
  getEvents,
  getEvent as libGetEvent,
  upsertRSVP as libUpsertRSVP,
  removeRSVP as libRemoveRSVP,
  subscribeToEvents,
} from '@/lib/events';

export interface EventsState {
  events: EventWithMeta[];
  isLoading: boolean;
  error: string | null;
  getEvent: (eventId: string) => Promise<EventWithMeta | null>;
  createEvent: (params: {
    group_id: string;
    title: string;
    start_at: string;
    end_at: string;
    importance: Importance;
    description?: string;
    location?: string;
  }) => Promise<void>;
  updateEvent: (
    eventId: string,
    params: Partial<Omit<Event, 'id' | 'group_id' | 'created_by' | 'created_at'>>,
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  upsertRSVP: (eventId: string, status: RSVPStatus) => Promise<void>;
  removeRSVP: (eventId: string) => Promise<void>;
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function useEvents(groupId: string | null): EventsState {
  const { user } = useAuth();

  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  // ── Fetch events for the current month ────────────────────────────────

  useEffect(() => {
    if (!groupId) {
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

        const { from, to } = getMonthRange();
        const fetched = await getEvents(groupId, from, to);
        if (cancelled) return;

        setEvents(fetched);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load events');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [groupId]);

  // ── Realtime subscription ─────────────────────────────────────────────

  useEffect(() => {
    if (!groupId) return;

    const channel = subscribeToEvents(groupId, () => {
      if (groupIdRef.current !== groupId) return;

      const { from, to } = getMonthRange();
      getEvents(groupId, from, to)
        .then(fetched => setEvents(fetched))
        .catch(() => undefined);
    });

    return () => { channel.unsubscribe(); };
  }, [groupId]);

  // ── Actions ───────────────────────────────────────────────────────────

  const getEvent = useCallback(async (eventId: string): Promise<EventWithMeta | null> => {
    try {
      setError(null);
      return await libGetEvent(eventId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load event';
      setError(msg);
      throw e;
    }
  }, []);

  const createEvent = useCallback(async (params: {
    group_id: string;
    title: string;
    start_at: string;
    end_at: string;
    importance: Importance;
    description?: string;
    location?: string;
  }): Promise<void> => {
    try {
      setError(null);
      await libCreateEvent(params);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create event';
      setError(msg);
      throw e;
    }
  }, []);

  const updateEvent = useCallback(async (
    eventId: string,
    params: Partial<Omit<Event, 'id' | 'group_id' | 'created_by' | 'created_at'>>,
  ): Promise<void> => {
    try {
      setError(null);
      await libUpdateEvent(eventId, params);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update event';
      setError(msg);
      throw e;
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string): Promise<void> => {
    try {
      setError(null);
      await libDeleteEvent(eventId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete event';
      setError(msg);
      throw e;
    }
  }, []);

  const upsertRSVP = useCallback(async (
    eventId: string,
    status: RSVPStatus,
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Optimistically update local state
    setEvents(prev => prev.map(evt => {
      if (evt.id !== eventId) return evt;
      const existingIdx = evt.rsvps.findIndex(r => r.user_id === user.id);
      const optimisticRsvp = {
        id: existingIdx >= 0 ? evt.rsvps[existingIdx].id : `optimistic-${Date.now()}`,
        event_id: eventId,
        user_id: user.id,
        status,
        updated_at: new Date().toISOString(),
        user: {
          id: user.id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
      };
      const newRsvps = existingIdx >= 0
        ? evt.rsvps.map((r, i) => (i === existingIdx ? optimisticRsvp : r))
        : [...evt.rsvps, optimisticRsvp];
      return { ...evt, rsvps: newRsvps };
    }));

    try {
      setError(null);
      await libUpsertRSVP(eventId, status);
    } catch (e) {
      // Revert: re-fetch events on failure
      if (groupIdRef.current) {
        const { from, to } = getMonthRange();
        getEvents(groupIdRef.current, from, to)
          .then(fetched => setEvents(fetched))
          .catch(() => undefined);
      }
      const msg = e instanceof Error ? e.message : 'Failed to update RSVP';
      setError(msg);
      throw e;
    }
  }, [user]);

  const removeRSVP = useCallback(async (eventId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Optimistically remove the RSVP from local state
    setEvents(prev => prev.map(evt => {
      if (evt.id !== eventId) return evt;
      return { ...evt, rsvps: evt.rsvps.filter(r => r.user_id !== user.id) };
    }));

    try {
      setError(null);
      await libRemoveRSVP(eventId);
    } catch (e) {
      // Revert: re-fetch events on failure
      if (groupIdRef.current) {
        const { from, to } = getMonthRange();
        getEvents(groupIdRef.current, from, to)
          .then(fetched => setEvents(fetched))
          .catch(() => undefined);
      }
      const msg = e instanceof Error ? e.message : 'Failed to remove RSVP';
      setError(msg);
      throw e;
    }
  }, [user]);

  return {
    events,
    isLoading,
    error,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    upsertRSVP,
    removeRSVP,
  };
}
