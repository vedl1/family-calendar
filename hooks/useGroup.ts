/**
 * hooks/useGroup.ts — Group state and actions for the active family group.
 * Persists the active group selection across app restarts via AsyncStorage.
 */

import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group, GroupMember, User } from '@/contracts/types';
import { useAuth } from '@/hooks/useAuth';
import {
  createGroup as libCreateGroup,
  getGroupsForUser,
  inviteMember as libInviteMember,
  promoteMember as libPromoteMember,
  demoteMember as libDemoteMember,
  removeMember as libRemoveMember,
  getMembers,
} from '@/lib/groups';

const ACTIVE_GROUP_KEY = 'activeGroupId';

export interface GroupState {
  /** The group currently selected by the user. */
  activeGroup: Group | null;
  /** All groups the current user is an active member of. */
  groups: Group[];
  /** All members of the active group, joined with their user profile rows. */
  members: (GroupMember & { user: User })[];
  /** True when the current user holds the admin role in the active group. */
  isAdmin: boolean;
  /** Switch the active group and persist the choice. */
  setActiveGroup: (group: Group) => void;
  createGroup: (params: { name: string; description?: string }) => Promise<void>;
  inviteMember: (emailOrPhone: string) => Promise<void>;
  promoteMember: (userId: string) => Promise<void>;
  demoteMember: (userId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useGroup(): GroupState {
  const { user } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroupState] = useState<Group | null>(null);
  const [members, setMembers] = useState<(GroupMember & { user: User })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref so the members effect can read the latest groups without being a dep.
  const groupsRef = useRef<Group[]>([]);
  groupsRef.current = groups;

  // ── Effect 1: load groups and restore activeGroup from storage ──────────
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setActiveGroupState(null);
      setMembers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fetched = await getGroupsForUser(user.id);
        if (cancelled) return;

        setGroups(fetched);

        const storedId = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
        if (cancelled) return;

        const restored =
          (storedId ? fetched.find(g => g.id === storedId) : undefined) ??
          fetched[0] ??
          null;

        setActiveGroupState(restored);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load groups');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Effect 2: load members whenever the active group changes ────────────
  useEffect(() => {
    if (!activeGroup) {
      setMembers([]);
      return;
    }

    const groupId = activeGroup.id;
    let cancelled = false;

    (async () => {
      try {
        const fetched = await getMembers(groupId);
        if (cancelled) return;

        setMembers(fetched);

        // If the current user is no longer an active member, auto-switch.
        if (user) {
          const mine = fetched.find(m => m.user_id === user.id);
          if (!mine || mine.status !== 'active') {
            const currentGroups = groupsRef.current;
            const next = currentGroups.find(g => g.id !== groupId) ?? null;
            setActiveGroupState(next);
            if (next) {
              await AsyncStorage.setItem(ACTIVE_GROUP_KEY, next.id);
            } else {
              await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load members');
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.id, user?.id]);

  // ── Derived state ────────────────────────────────────────────────────────

  const isAdmin =
    !!user &&
    members.some(
      m => m.user_id === user.id && m.role === 'admin' && m.status === 'active',
    );

  // ── Actions ──────────────────────────────────────────────────────────────

  const setActiveGroup = (group: Group): void => {
    setActiveGroupState(group);
    // Fire-and-forget — state is already updated synchronously.
    AsyncStorage.setItem(ACTIVE_GROUP_KEY, group.id).catch(() => undefined);
  };

  const createGroup = async (params: {
    name: string;
    description?: string;
  }): Promise<void> => {
    try {
      setError(null);
      const newGroup = await libCreateGroup(params);
      setGroups(prev => [...prev, newGroup]);
      setActiveGroupState(newGroup);
      await AsyncStorage.setItem(ACTIVE_GROUP_KEY, newGroup.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create group';
      setError(msg);
      throw e;
    }
  };

  const inviteMember = async (emailOrPhone: string): Promise<void> => {
    if (!activeGroup) throw new Error('No active group selected');
    try {
      setError(null);
      await libInviteMember(activeGroup.id, emailOrPhone);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to invite member';
      setError(msg);
      throw e;
    }
  };

  const promoteMember = async (userId: string): Promise<void> => {
    if (!activeGroup) throw new Error('No active group selected');
    try {
      setError(null);
      await libPromoteMember(activeGroup.id, userId);
      setMembers(prev =>
        prev.map(m => (m.user_id === userId ? { ...m, role: 'admin' as const } : m)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to promote member';
      setError(msg);
      throw e;
    }
  };

  const demoteMember = async (userId: string): Promise<void> => {
    if (!activeGroup) throw new Error('No active group selected');
    try {
      setError(null);
      await libDemoteMember(activeGroup.id, userId);
      setMembers(prev =>
        prev.map(m => (m.user_id === userId ? { ...m, role: 'member' as const } : m)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to demote member';
      setError(msg);
      throw e;
    }
  };

  const removeMember = async (userId: string): Promise<void> => {
    if (!activeGroup) throw new Error('No active group selected');
    try {
      setError(null);
      await libRemoveMember(activeGroup.id, userId);

      setMembers(prev => prev.filter(m => m.user_id !== userId));

      // If the current user removed themselves, switch to the next group.
      if (user && userId === user.id) {
        const remaining = groups.filter(g => g.id !== activeGroup.id);
        setGroups(remaining);
        const next = remaining[0] ?? null;
        setActiveGroupState(next);
        if (next) {
          await AsyncStorage.setItem(ACTIVE_GROUP_KEY, next.id);
        } else {
          await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove member';
      setError(msg);
      throw e;
    }
  };

  return {
    activeGroup,
    groups,
    members,
    isAdmin,
    setActiveGroup,
    createGroup,
    inviteMember,
    promoteMember,
    demoteMember,
    removeMember,
    isLoading,
    error,
  };
}
