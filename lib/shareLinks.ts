/**
 * lib/shareLinks.ts — Share-link management helper functions.
 * All functions throw on error (never return raw Supabase responses).
 * Types imported from @/contracts/types.
 * [VCH-48]
 */

import { randomUUID } from 'expo-crypto';
import type { ShareLink } from '@/contracts/types';
import { supabase } from '@/lib/supabase';

// ============================================================
// CRUD
// ============================================================

/**
 * Generate a new share link for a group.
 * Token is a UUID generated client-side. No expiry by default.
 */
export async function generateShareLink(groupId: string): Promise<ShareLink> {
  const token = randomUUID();

  const { data, error } = await supabase
    .from('share_links')
    .insert({ group_id: groupId, token, expires_at: null, revoked: false })
    .select()
    .single();

  if (error) throw error;
  return data as ShareLink;
}

/**
 * Revoke an existing share link (sets revoked = true).
 */
export async function revokeShareLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('share_links')
    .update({ revoked: true })
    .eq('id', linkId);

  if (error) throw error;
}

/**
 * Validate a share link by token.
 * Throws if the link is revoked or expired.
 */
export async function validateShareLink(token: string): Promise<ShareLink> {
  const { data, error } = await supabase
    .from('share_links')
    .select()
    .eq('token', token)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Invalid share link');

  const link = data as ShareLink;

  if (link.revoked) {
    throw new Error('This share link has been revoked');
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new Error('This share link has expired');
  }

  return link;
}

/**
 * Return all share links for a group.
 */
export async function getShareLinksForGroup(groupId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select()
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ShareLink[];
}
