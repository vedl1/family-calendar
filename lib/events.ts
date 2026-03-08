/**
 * lib/events.ts — Event management helper functions.
 * All functions throw on error (never return raw Supabase responses).
 * Types imported from @/contracts/types.
 * [VCH-45]
 */

import type {
  Event,
  EventWithMeta,
  Importance,
  RSVP,
  RSVPStatus,
} from '@/contracts/types';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// CRUD
// ============================================================

/**
 * Create a new event in the given group.
 * `start_at` and `end_at` are ISO datetime strings; they are mapped to the
 * DB columns `event_date`, `start_time`, and `duration_mins`.
 */
export async function createEvent(params: {
  group_id: string;
  title: string;
  start_at: string;
  end_at: string;
  importance: Importance;
  description?: string;
  location?: string;
}): Promise<Event> {
  const startDate = new Date(params.start_at);
  const endDate = new Date(params.end_at);

  const event_date = startDate.toISOString().slice(0, 10);
  const hh = String(startDate.getUTCHours()).padStart(2, '0');
  const mm = String(startDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(startDate.getUTCSeconds()).padStart(2, '0');
  const start_time = `${hh}:${mm}:${ss}`;
  const duration_mins = Math.round((endDate.getTime() - startDate.getTime()) / 60_000);

  const { data, error } = await supabase
    .from('events')
    .insert({
      group_id: params.group_id,
      title: params.title,
      description: params.description ?? null,
      importance: params.importance,
      location: params.location ?? null,
      event_date,
      start_time,
      duration_mins,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Event;
}

/**
 * Fetch events for a group within a date range.
 * Returns EventWithMeta[] — each event joined with creator info and rsvps.
 * `from` and `to` are ISO date strings (YYYY-MM-DD).
 */
export async function getEvents(
  groupId: string,
  from: string,
  to: string,
): Promise<EventWithMeta[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:users!created_by(id, display_name, avatar_url),
      rsvps(*, user:users!user_id(id, display_name, avatar_url))
    `)
    .eq('group_id', groupId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data as unknown as EventWithMeta[];
}

/**
 * Update an existing event. Only the provided fields are changed.
 */
export async function updateEvent(
  eventId: string,
  params: Partial<Omit<Event, 'id' | 'group_id' | 'created_by' | 'created_at'>>,
): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(params)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data as Event;
}

/**
 * Hard-delete an event. RLS enforces creator-or-admin only at DB level.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

// ============================================================
// RSVP
// ============================================================

/**
 * Create or update the current user's RSVP for an event.
 */
export async function upsertRSVP(
  eventId: string,
  status: RSVPStatus,
): Promise<RSVP> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('rsvps')
    .upsert(
      { event_id: eventId, user_id: user.id, status },
      { onConflict: 'event_id,user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as RSVP;
}

/**
 * Remove the current user's RSVP for an event.
 */
export async function removeRSVP(eventId: string): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ============================================================
// REALTIME
// ============================================================

/**
 * Subscribe to postgres_changes on the events table filtered by group_id.
 * Calls `callback` whenever an INSERT, UPDATE, or DELETE occurs.
 */
export function subscribeToEvents(
  groupId: string,
  callback: (event: Event) => void,
): RealtimeChannel {
  return supabase
    .channel(`events:group_id=eq.${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        callback((payload.new ?? payload.old) as Event);
      },
    )
    .subscribe();
}
