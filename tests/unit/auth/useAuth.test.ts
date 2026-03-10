/**
 * tests/unit/auth/useAuth.test.ts
 * Unit tests for hooks/useAuth.ts
 *
 * React hooks cannot be rendered in a plain node environment without jsdom +
 * @testing-library/react. We test the hook by mocking React's useState and
 * useEffect to call the hook body directly, and verify:
 *   - the returned shape matches the AuthState interface
 *   - each action function delegates to the correct lib/auth helper
 *   - derived state (isAuthenticated) is computed correctly
 * [VCH-41]
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '@/hooks/useAuth';
import type { AuthState } from '@/hooks/useAuth';

// ── Hoisted mock values (accessible inside vi.mock factories) ─────────────────

const {
  mockSubscription,
  mockAuthClient,
  mockSignInWithGoogle,
  mockSendOTP,
  mockVerifyOTP,
  mockSignOut,
  mockCreateOrUpdateUserProfile,
  mockGetCurrentUser,
} = vi.hoisted(() => {
  const mockSubscription = { unsubscribe: vi.fn() };
  const mockAuthClient = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: mockSubscription } })),
  };
  return {
    mockSubscription,
    mockAuthClient,
    mockSignInWithGoogle: vi.fn().mockResolvedValue(undefined),
    mockSendOTP: vi.fn().mockResolvedValue(undefined),
    mockVerifyOTP: vi.fn().mockResolvedValue(undefined),
    mockSignOut: vi.fn().mockResolvedValue(undefined),
    mockCreateOrUpdateUserProfile: vi.fn(),
    mockGetCurrentUser: vi.fn().mockResolvedValue(null),
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuthClient,
  },
}));

vi.mock('@/lib/auth', () => ({
  signInWithGoogle: mockSignInWithGoogle,
  sendOTP: mockSendOTP,
  verifyOTP: mockVerifyOTP,
  signOut: mockSignOut,
  createOrUpdateUserProfile: mockCreateOrUpdateUserProfile,
  getCurrentUser: mockGetCurrentUser,
}));

// ── React mock — allows calling the hook outside a render cycle ───────────────
//
// useState: returns [initialValue, setter] where setter is a vi.fn().
// useEffect: calls the callback synchronously so the mount logic runs.

vi.mock('react', () => ({
  useState: <T>(initial: T): [T, (v: T) => void] => [initial, vi.fn()],
  useEffect: (cb: () => void | (() => void)) => { cb(); },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAuth — returned shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthClient.getSession.mockResolvedValue({ data: { session: null } });
    mockAuthClient.onAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } });
  });

  it('returns all required AuthState fields', () => {
    const state = useAuth();

    const requiredKeys: (keyof AuthState)[] = [
      'user',
      'session',
      'isLoading',
      'isAuthenticated',
      'signInWithGoogle',
      'sendOTP',
      'verifyOTP',
      'signOut',
      'updateProfile',
    ];

    for (const key of requiredKeys) {
      expect(state).toHaveProperty(key);
    }
  });

  it('initial state: user=null, session=null, isLoading=true', () => {
    const { user, session, isLoading } = useAuth();

    expect(user).toBeNull();
    expect(session).toBeNull();
    expect(isLoading).toBe(true);
  });

  it('isAuthenticated is false when session is null', () => {
    const { isAuthenticated } = useAuth();

    expect(isAuthenticated).toBe(false);
  });

  it('action fields are functions', () => {
    const state = useAuth();

    expect(typeof state.signInWithGoogle).toBe('function');
    expect(typeof state.sendOTP).toBe('function');
    expect(typeof state.verifyOTP).toBe('function');
    expect(typeof state.signOut).toBe('function');
    expect(typeof state.updateProfile).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — action delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthClient.getSession.mockResolvedValue({ data: { session: null } });
    mockAuthClient.onAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } });
  });

  it('signInWithGoogle delegates to authSignInWithGoogle', async () => {
    const { signInWithGoogle } = useAuth();

    await signInWithGoogle();

    expect(mockSignInWithGoogle).toHaveBeenCalledOnce();
  });

  it('sendOTP delegates to authSendOTP with the provided phone number', async () => {
    const { sendOTP } = useAuth();

    await sendOTP('+14155552671');

    expect(mockSendOTP).toHaveBeenCalledOnce();
    expect(mockSendOTP).toHaveBeenCalledWith('+14155552671');
  });

  it('verifyOTP delegates to authVerifyOTP with phone and token', async () => {
    const { verifyOTP } = useAuth();

    await verifyOTP('+14155552671', '123456');

    expect(mockVerifyOTP).toHaveBeenCalledOnce();
    expect(mockVerifyOTP).toHaveBeenCalledWith('+14155552671', '123456');
  });

  it('signOut delegates to authSignOut', async () => {
    const { signOut } = useAuth();

    await signOut();

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('updateProfile delegates to createOrUpdateUserProfile', async () => {
    const updatedUser = {
      id: 'user-123',
      email: 'test@example.com',
      phone: null,
      display_name: 'Updated Name',
      avatar_url: null,
      created_at: '2026-03-05T00:00:00Z',
    };
    mockCreateOrUpdateUserProfile.mockResolvedValue(updatedUser);

    const { updateProfile } = useAuth();

    await updateProfile({ display_name: 'Updated Name' });

    expect(mockCreateOrUpdateUserProfile).toHaveBeenCalledOnce();
    expect(mockCreateOrUpdateUserProfile).toHaveBeenCalledWith({ display_name: 'Updated Name' });
  });

  it('updateProfile passes avatar_url when provided', async () => {
    mockCreateOrUpdateUserProfile.mockResolvedValue({
      id: 'user-123',
      display_name: 'Test',
      avatar_url: 'https://example.com/avatar.jpg',
      email: null,
      phone: null,
      created_at: '2026-03-05T00:00:00Z',
    });

    const { updateProfile } = useAuth();

    await updateProfile({ display_name: 'Test', avatar_url: 'https://example.com/avatar.jpg' });

    expect(mockCreateOrUpdateUserProfile).toHaveBeenCalledWith({
      display_name: 'Test',
      avatar_url: 'https://example.com/avatar.jpg',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useAuth — mount effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthClient.getSession.mockResolvedValue({ data: { session: null } });
    mockAuthClient.onAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } });
  });

  it('calls supabase.auth.getSession on mount', () => {
    useAuth();

    expect(mockAuthClient.getSession).toHaveBeenCalledOnce();
  });

  it('sets up an onAuthStateChange subscription on mount', () => {
    useAuth();

    expect(mockAuthClient.onAuthStateChange).toHaveBeenCalledOnce();
  });
});
