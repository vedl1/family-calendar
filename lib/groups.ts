/**
 * lib/groups.ts — Group management helper functions.
 * All functions throw on error (never return raw Supabase responses).
 * Types imported from @/contracts/types.
 */

import type { Group, GroupMember, User } from '@/contracts/types';
import { supabase } from '@/lib/supabase';

// ============================================================
// CUSTOM ERRORS
// ============================================================

/**
 * Thrown by demoteMember when demoting would leave the group with no active admins.
 */
export class GroupMustHaveAdminError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} must retain at least one active admin`);
    this.name = 'GroupMustHaveAdminError';
  }
}

// ============================================================
// GROUP CRUD
// ============================================================

/**
 * Create a new group.
 * The DB trigger (trg_group_created) automatically inserts the creator
 * as an active admin — do NOT manually insert into group_members.
 */
export async function createGroup(params: {
  name: string;
  description?: string;
}): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: params.name, description: params.description ?? null })
    .select()
    .single();

  if (error) throw error;
  return data as Group;
}

/**
 * Return all groups where the given user is an active member.
 */
export async function getGroupsForUser(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('groups!inner(*)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;
  return (data as unknown as { groups: Group }[]).map(row => row.groups);
}

// ============================================================
// MEMBERSHIP
// ============================================================

/**
 * Invite a user to the group by email address or E.164 phone number.
 * Looks up the user in the public users table, then inserts a pending membership.
 */
export async function inviteMember(groupId: string, emailOrPhone: string): Promise<void> {
  const isEmail = emailOrPhone.includes('@');
  const filter = isEmail ? { email: emailOrPhone } : { phone: emailOrPhone };

  const { data: userRow, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .match(filter)
    .single();

  if (lookupError) throw lookupError;
  if (!userRow) throw new Error(`No user found for "${emailOrPhone}"`);

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userRow.id, role: 'member', status: 'pending' });

  if (error) throw error;
}

/**
 * Approve a pending member invite, making them an active member.
 */
export async function approveMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'active' })
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
}

/**
 * Reject a pending member invite (sets status to 'removed').
 */
export async function rejectMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
}

/**
 * Remove an active member from the group (sets status to 'removed').
 */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Return all members of a group joined with their user profile rows.
 */
export async function getMembers(groupId: string): Promise<(GroupMember & { user: User })[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, users(*)')
    .eq('group_id', groupId);

  if (error) throw error;

  return (data as (GroupMember & { users: User })[]).map(({ users, ...member }) => ({
    ...member,
    user: users,
  }));
}

// ============================================================
// ADMIN ROLES
// ============================================================

/**
 * Promote a member to admin role.
 */
export async function promoteMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ role: 'admin' })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Demote an admin to member role.
 * Throws GroupMustHaveAdminError if the target is the sole active admin.
 */
export async function demoteMember(groupId: string, userId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('role', 'admin')
    .eq('status', 'active');

  if (countError) throw countError;
  if (count === 1) throw new GroupMustHaveAdminError(groupId);

  const { error } = await supabase
    .from('group_members')
    .update({ role: 'member' })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ============================================================
// INVITE LINKS
// ============================================================

/**
 * Join a group using a share-link token.
 * Validates the token (not revoked, not expired), then upserts the current
 * user as an active member (handles re-joining after removal).
 */
export async function joinGroupByInviteLink(token: string): Promise<void> {
  const { data: link, error: linkError } = await supabase
    .from('share_links')
    .select('group_id, revoked, expires_at')
    .eq('token', token)
    .single();

  if (linkError) throw linkError;
  if (!link) throw new Error('Invalid invite link');
  if (link.revoked) throw new Error('This invite link has been revoked');
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new Error('This invite link has expired');
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) throw new Error('Not authenticated');

  const membership = {
    group_id: link.group_id,
    user_id: session.user.id,
    role: 'member' as const,
    status: 'active' as const,
  };

  const { error: insertError } = await supabase.from('group_members').insert(membership);
  if (!insertError) return;

  // Idempotent re-join path: existing membership row, ensure it is active.
  if (insertError.code !== '23505') throw insertError;

  const { error: updateError } = await supabase
    .from('group_members')
    .update({ role: 'member', status: 'active' })
    .eq('group_id', link.group_id)
    .eq('user_id', session.user.id);

  if (updateError) throw updateError;
}
