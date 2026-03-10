/**
 * lib/sharedCalendar.ts — Fetch events via share-link token.
 * Uses the `set_share_token` RPC to set a session-scoped config var
 * that the events SELECT RLS policy checks for access.
 * [VCH-51]
 */

import type { EventWithMeta } from '@/contracts/types';
import { supabase } from '@/lib/supabase';

/**
 * Fetch all events accessible via the given share-link token.
 * Sets the session token via RPC, then queries events with the same
 * embedded join used by `getEvents` in lib/events.ts.
 * RLS scopes the result to the share link's group automatically.
 */
export async function getSharedEvents(
  token: string,
): Promise<EventWithMeta[]> {
  const { error: rpcError } = await supabase.rpc('set_share_token', {
    p_token: token,
  });
  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:users!created_by(id, display_name, avatar_url),
      rsvps(*, user:users!user_id(id, display_name, avatar_url))
    `)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data as unknown as EventWithMeta[];
}

/**
 * Clear the session share token (best-effort cleanup).
 */
export async function clearShareToken(): Promise<void> {
  try {
    await supabase.rpc('set_share_token', { p_token: null });
  } catch {
    // best-effort — swallow errors
  }
}
