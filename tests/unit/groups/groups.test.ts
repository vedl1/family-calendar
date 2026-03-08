/**
 * tests/unit/groups/groups.test.ts
 * Unit tests for lib/groups.ts and the isAdmin derivation in hooks/useGroup.ts.
 * Supabase is fully mocked — no real DB calls.
 * [VCH-44]
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  createGroup,
  getGroupsForUser,
  inviteMember,
  removeMember,
  demoteMember,
  GroupMustHaveAdminError,
} from '@/lib/groups';
import { useGroup } from '@/hooks/useGroup';
import type { Group, GroupMember, User } from '@/contracts/types';

// ── Hoisted values (accessible inside vi.mock factories) ──────────────────────

const { stateConfig, mockUseAuthFn } = vi.hoisted(() => ({
  stateConfig: {
    callIdx: 0,
    overrides: {} as Record<number, unknown>,
  },
  mockUseAuthFn: vi.fn(() => ({
    user: null as User | null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    signInWithGoogle: vi.fn(),
    sendOTP: vi.fn(),
    verifyOTP: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
  })),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

// React — lets us call useGroup() directly without a render cycle.
// useState: returns [initial, setter] unless stateConfig.overrides has an entry
//   for the current call index (used to inject members for isAdmin tests).
// useEffect: calls its callback synchronously.
// useRef: returns a plain ref object.
vi.mock('react', () => ({
  useState: <T>(initial: T): [T, (v: T) => void] => {
    const idx = stateConfig.callIdx++;
    if (idx in stateConfig.overrides) {
      return [stateConfig.overrides[idx] as T, vi.fn()];
    }
    return [initial, vi.fn()];
  },
  useEffect: (cb: () => void | (() => void)) => { cb(); },
  useRef: <T>(initial: T) => ({ current: initial }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: mockUseAuthFn }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

let mockFromChain: ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFromChain(...args),
    auth: { getUser: vi.fn() },
  },
}));

// ── Chain builder ─────────────────────────────────────────────────────────────

/**
 * Build a fully chainable Supabase query mock that resolves to `result`.
 * Supports `.select().eq().eq()...`, `.insert()`, `.update()`, `.single()`, etc.
 * Awaiting the chain (or any method on it) resolves to `result`.
 */
function buildChain(result: unknown) {
  const promise = Promise.resolve(result);

  const chain: Record<string, unknown> = {
    // Awaitable via `then` / `catch`
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      promise.then(res, rej),
    catch: (fn: (e: unknown) => unknown) => promise.catch(fn),
    // .single() returns the settled promise directly
    single: vi.fn(() => promise),
  };

  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'match', 'neq']) {
    chain[m] = vi.fn(() => chain);
  }

  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_GROUP: Group = {
  id: 'group-abc',
  name: 'Smith Family',
  description: null,
  created_by: 'user-123',
  created_at: '2026-03-06T00:00:00Z',
};

const MOCK_USER: User = {
  id: 'user-123',
  email: 'test@example.com',
  phone: null,
  display_name: 'Test User',
  avatar_url: null,
  created_at: '2026-03-06T00:00:00Z',
};

const MOCK_MEMBER_BASE = {
  id: 'mem-1',
  group_id: 'group-abc',
  user_id: 'user-123',
  joined_at: '2026-03-06T00:00:00Z',
  user: MOCK_USER,
};

const ADMIN_MEMBER: GroupMember & { user: User } = {
  ...MOCK_MEMBER_BASE,
  role: 'admin',
  status: 'active',
};

const REGULAR_MEMBER: GroupMember & { user: User } = {
  ...MOCK_MEMBER_BASE,
  role: 'member',
  status: 'active',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStateConfig() {
  stateConfig.callIdx = 0;
  stateConfig.overrides = {};
}

// ── lib/groups.ts tests ───────────────────────────────────────────────────────

describe('createGroup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves with the created Group on success', async () => {
    mockFromChain = vi.fn(() => buildChain({ data: MOCK_GROUP, error: null }));

    const result = await createGroup({ name: 'Smith Family' });

    expect(result).toEqual(MOCK_GROUP);
    expect(mockFromChain).toHaveBeenCalledWith('groups');
  });

  it('includes description when provided', async () => {
    const groupWithDesc = { ...MOCK_GROUP, description: 'Our family group' };
    mockFromChain = vi.fn(() => buildChain({ data: groupWithDesc, error: null }));

    const result = await createGroup({ name: 'Smith Family', description: 'Our family group' });

    expect(result.description).toBe('Our family group');
  });

  it('throws when Supabase returns an error', async () => {
    const dbError = new Error('Insert failed');
    mockFromChain = vi.fn(() => buildChain({ data: null, error: dbError }));

    await expect(createGroup({ name: 'Smith Family' })).rejects.toThrow('Insert failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getGroupsForUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps inner-join rows ({ groups: Group }[]) to Group[]', async () => {
    const innerJoinRows = [{ groups: MOCK_GROUP }];
    mockFromChain = vi.fn(() => buildChain({ data: innerJoinRows, error: null }));

    const result = await getGroupsForUser('user-123');

    expect(result).toEqual([MOCK_GROUP]);
    expect(mockFromChain).toHaveBeenCalledWith('group_members');
  });

  it('returns an empty array when the user is not a member of any group', async () => {
    mockFromChain = vi.fn(() => buildChain({ data: [], error: null }));

    const result = await getGroupsForUser('user-123');

    expect(result).toEqual([]);
  });

  it('returns multiple groups when the user is an active member of several', async () => {
    const group2: Group = { ...MOCK_GROUP, id: 'group-def', name: 'Work Team' };
    const rows = [{ groups: MOCK_GROUP }, { groups: group2 }];
    mockFromChain = vi.fn(() => buildChain({ data: rows, error: null }));

    const result = await getGroupsForUser('user-123');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('group-abc');
    expect(result[1].id).toBe('group-def');
  });

  it('throws when Supabase returns an error', async () => {
    const dbError = new Error('Network error');
    mockFromChain = vi.fn(() => buildChain({ data: null, error: dbError }));

    await expect(getGroupsForUser('user-123')).rejects.toThrow('Network error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('inviteMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a pending membership row when the user is found by email', async () => {
    const userLookupChain = buildChain({ data: { id: 'user-456' }, error: null });
    const insertChain = buildChain({ error: null });
    mockFromChain = vi.fn()
      .mockReturnValueOnce(userLookupChain)
      .mockReturnValueOnce(insertChain);

    await expect(inviteMember('group-abc', 'alice@example.com')).resolves.toBeUndefined();
    expect(mockFromChain).toHaveBeenCalledTimes(2);
    expect(mockFromChain).toHaveBeenNthCalledWith(1, 'users');
    expect(mockFromChain).toHaveBeenNthCalledWith(2, 'group_members');
  });

  it('inserts a pending membership row when the user is found by phone number', async () => {
    const userLookupChain = buildChain({ data: { id: 'user-456' }, error: null });
    const insertChain = buildChain({ error: null });
    mockFromChain = vi.fn()
      .mockReturnValueOnce(userLookupChain)
      .mockReturnValueOnce(insertChain);

    await expect(inviteMember('group-abc', '+14155552671')).resolves.toBeUndefined();
    expect(mockFromChain).toHaveBeenNthCalledWith(1, 'users');
  });

  it('throws when the user lookup fails', async () => {
    const lookupError = new Error('User not found');
    mockFromChain = vi.fn(() => buildChain({ data: null, error: lookupError }));

    await expect(inviteMember('group-abc', 'nobody@example.com')).rejects.toThrow('User not found');
  });

  it('throws when the membership insert fails', async () => {
    const userLookupChain = buildChain({ data: { id: 'user-456' }, error: null });
    const insertError = new Error('Duplicate membership');
    const insertChain = buildChain({ error: insertError });
    mockFromChain = vi.fn()
      .mockReturnValueOnce(userLookupChain)
      .mockReturnValueOnce(insertChain);

    await expect(inviteMember('group-abc', 'alice@example.com')).rejects.toThrow('Duplicate membership');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('removeMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves when the update succeeds (sets status to removed)', async () => {
    mockFromChain = vi.fn(() => buildChain({ error: null }));

    await expect(removeMember('group-abc', 'user-456')).resolves.toBeUndefined();
    expect(mockFromChain).toHaveBeenCalledWith('group_members');
  });

  it('throws when Supabase returns an error', async () => {
    const dbError = new Error('Update failed');
    mockFromChain = vi.fn(() => buildChain({ error: dbError }));

    await expect(removeMember('group-abc', 'user-456')).rejects.toThrow('Update failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('demoteMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws GroupMustHaveAdminError when there is exactly one active admin', async () => {
    // First from() call: count query returns 1 admin
    mockFromChain = vi.fn(() => buildChain({ count: 1, error: null }));

    await expect(demoteMember('group-abc', 'user-123')).rejects.toThrow(GroupMustHaveAdminError);
    await expect(demoteMember('group-abc', 'user-123')).rejects.toThrow(
      'Group group-abc must retain at least one active admin',
    );
  });

  it('does not call the UPDATE when admin count is 1', async () => {
    mockFromChain = vi.fn(() => buildChain({ count: 1, error: null }));

    await expect(demoteMember('group-abc', 'user-123')).rejects.toThrow(GroupMustHaveAdminError);
    // Only the count query should have been called
    expect(mockFromChain).toHaveBeenCalledTimes(1);
  });

  it('succeeds and updates the role when there are 2+ active admins', async () => {
    const countChain = buildChain({ count: 2, error: null });
    const updateChain = buildChain({ error: null });
    mockFromChain = vi.fn()
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(updateChain);

    await expect(demoteMember('group-abc', 'user-123')).resolves.toBeUndefined();
    expect(mockFromChain).toHaveBeenCalledTimes(2);
    expect(mockFromChain).toHaveBeenNthCalledWith(1, 'group_members');
    expect(mockFromChain).toHaveBeenNthCalledWith(2, 'group_members');
  });

  it('throws when the count query fails', async () => {
    const countError = new Error('DB unreachable');
    mockFromChain = vi.fn(() => buildChain({ count: null, error: countError }));

    await expect(demoteMember('group-abc', 'user-123')).rejects.toThrow('DB unreachable');
  });
});

// ── hooks/useGroup.ts — isAdmin derivation ────────────────────────────────────
//
// isAdmin is computed synchronously in the hook body:
//   !!user && members.some(m => m.user_id === user.id && m.role === 'admin' && m.status === 'active')
//
// We control `user` via the useAuth mock and `members` by overriding the 3rd
// useState call (index 2) via stateConfig.overrides.

describe('useGroup — isAdmin derivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStateConfig();
    // Default: effects won't error — supabase returns empty/null
    mockFromChain = vi.fn(() => buildChain({ data: [], error: null }));
  });

  it('returns isAdmin=true when the current user is an active admin of the group', () => {
    mockUseAuthFn.mockReturnValue({
      user: MOCK_USER,
      session: null,
      isLoading: false,
      isAuthenticated: true,
      signInWithGoogle: vi.fn(),
      sendOTP: vi.fn(),
      verifyOTP: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    });
    // Inject admin member at useState call index 2 (members slot)
    stateConfig.overrides[2] = [ADMIN_MEMBER];

    const { isAdmin } = useGroup();

    expect(isAdmin).toBe(true);
  });

  it('returns isAdmin=false when the current user is a regular member', () => {
    mockUseAuthFn.mockReturnValue({
      user: MOCK_USER,
      session: null,
      isLoading: false,
      isAuthenticated: true,
      signInWithGoogle: vi.fn(),
      sendOTP: vi.fn(),
      verifyOTP: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    });
    stateConfig.overrides[2] = [REGULAR_MEMBER];

    const { isAdmin } = useGroup();

    expect(isAdmin).toBe(false);
  });

  it('returns isAdmin=false when there is no authenticated user', () => {
    mockUseAuthFn.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      signInWithGoogle: vi.fn(),
      sendOTP: vi.fn(),
      verifyOTP: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    });
    stateConfig.overrides[2] = [ADMIN_MEMBER];

    const { isAdmin } = useGroup();

    expect(isAdmin).toBe(false);
  });

  it('returns isAdmin=false when the members list is empty', () => {
    mockUseAuthFn.mockReturnValue({
      user: MOCK_USER,
      session: null,
      isLoading: false,
      isAuthenticated: true,
      signInWithGoogle: vi.fn(),
      sendOTP: vi.fn(),
      verifyOTP: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
    });
    // Default: members override is [] (the useState initial value is used)

    const { isAdmin } = useGroup();

    expect(isAdmin).toBe(false);
  });
});
