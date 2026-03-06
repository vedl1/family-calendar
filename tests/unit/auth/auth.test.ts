/**
 * tests/unit/auth/auth.test.ts
 * Unit tests for lib/auth.ts — all functions, happy path + error path.
 * [VCH-41]
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as WebBrowser from 'expo-web-browser';
import {
  signInWithGoogle,
  sendOTP,
  verifyOTP,
  signOut,
  getSession,
  createOrUpdateUserProfile,
  getCurrentUser,
} from '@/lib/auth';

// ── External module mocks (hoisted before imports) ────────────────────────────

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));

vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'myapp://auth/callback'),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockAuth = {
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
};

// Chain builder helpers — recreated per-test via beforeEach
let mockSingle: ReturnType<typeof vi.fn>;
let mockFromChain: ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
    from: (...args: unknown[]) => mockFromChain(...args),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: { id: 'user-123', email: 'test@example.com' },
} as unknown as import('@supabase/supabase-js').Session;

const MOCK_USER: import('@/contracts/types').User = {
  id: 'user-123',
  email: 'test@example.com',
  phone: null,
  display_name: 'Test User',
  avatar_url: null,
  created_at: '2026-03-05T00:00:00Z',
};

const MOCK_AUTH_USER = {
  id: 'user-123',
  email: 'test@example.com',
  phone: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a chainable `supabase.from(table)` mock returning the given result. */
function buildFromChain(result: { data: unknown; error: unknown }) {
  mockSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single: mockSingle, eq: vi.fn(() => ({ single: mockSingle })) }));
  const upsert = vi.fn(() => ({ select }));
  mockFromChain = vi.fn(() => ({ upsert, select }));
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildFromChain({ data: null, error: null });
  });

  it('returns session on successful OAuth flow', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'myapp://auth/callback?code=abc123',
    } as never);
    mockAuth.exchangeCodeForSession.mockResolvedValue({
      data: { session: MOCK_SESSION },
      error: null,
    });

    const result = await signInWithGoogle();

    expect(result).toBe(MOCK_SESSION);
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'myapp://auth/callback', skipBrowserRedirect: true },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/auth?...',
      'myapp://auth/callback',
    );
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('myapp://auth/callback?code=abc123');
  });

  it('throws when supabase.auth.signInWithOAuth returns an error', async () => {
    const authError = new Error('OAuth init failed');
    mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: authError });

    await expect(signInWithGoogle()).rejects.toThrow('OAuth init failed');
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('throws when no OAuth URL is returned', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    await expect(signInWithGoogle()).rejects.toThrow('No OAuth URL returned from Supabase');
  });

  it('throws when the browser session is cancelled', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/auth' },
      error: null,
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: 'cancel' } as never);

    await expect(signInWithGoogle()).rejects.toThrow('Google sign-in was cancelled or failed');
  });

  it('throws when code exchange fails', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/auth' },
      error: null,
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'myapp://auth/callback?code=bad',
    } as never);
    const exchangeError = new Error('Code exchange failed');
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: exchangeError });

    await expect(signInWithGoogle()).rejects.toThrow('Code exchange failed');
  });

  it('throws when code exchange returns no session', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/auth' },
      error: null,
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'myapp://auth/callback?code=ok',
    } as never);
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(signInWithGoogle()).rejects.toThrow('No session returned after code exchange');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sendOTP', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves without error on success', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });

    await expect(sendOTP('+14155552671')).resolves.toBeUndefined();
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ phone: '+14155552671' });
  });

  it('throws the supabase error on failure', async () => {
    const otpError = new Error('Invalid phone number');
    mockAuth.signInWithOtp.mockResolvedValue({ error: otpError });

    await expect(sendOTP('+1invalid')).rejects.toThrow('Invalid phone number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('verifyOTP', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns session on successful verification', async () => {
    mockAuth.verifyOtp.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    const result = await verifyOTP('+14155552671', '123456');

    expect(result).toBe(MOCK_SESSION);
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      phone: '+14155552671',
      token: '123456',
      type: 'sms',
    });
  });

  it('throws the supabase error on failure', async () => {
    const verifyError = new Error('OTP expired');
    mockAuth.verifyOtp.mockResolvedValue({ data: { session: null }, error: verifyError });

    await expect(verifyOTP('+14155552671', '000000')).rejects.toThrow('OTP expired');
  });

  it('throws when no session is returned after verification', async () => {
    mockAuth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });

    await expect(verifyOTP('+14155552671', '123456')).rejects.toThrow(
      'No session returned after OTP verification',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('signOut', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves without error on success', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledOnce();
  });

  it('throws the supabase error on failure', async () => {
    const signOutError = new Error('Sign-out failed');
    mockAuth.signOut.mockResolvedValue({ error: signOutError });

    await expect(signOut()).rejects.toThrow('Sign-out failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the active session when one exists', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    const result = await getSession();

    expect(result).toBe(MOCK_SESSION);
  });

  it('returns null when no session exists', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await getSession();

    expect(result).toBeNull();
  });

  it('throws the supabase error on failure', async () => {
    const sessionError = new Error('Session fetch failed');
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: sessionError });

    await expect(getSession()).rejects.toThrow('Session fetch failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('createOrUpdateUserProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts and returns the user profile', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: MOCK_AUTH_USER },
      error: null,
    });
    buildFromChain({ data: MOCK_USER, error: null });

    const result = await createOrUpdateUserProfile({ display_name: 'Test User' });

    expect(result).toEqual(MOCK_USER);
    expect(mockFromChain).toHaveBeenCalledWith('users');
  });

  it('includes avatar_url when provided', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: MOCK_AUTH_USER },
      error: null,
    });
    const userWithAvatar = { ...MOCK_USER, avatar_url: 'https://example.com/avatar.jpg' };
    buildFromChain({ data: userWithAvatar, error: null });

    const result = await createOrUpdateUserProfile({
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    });

    expect(result.avatar_url).toBe('https://example.com/avatar.jpg');
  });

  it('throws when getUser returns an auth error', async () => {
    const authError = new Error('Not authenticated');
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: authError });

    await expect(createOrUpdateUserProfile({ display_name: 'Test' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws "Not authenticated" when getUser returns no user', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(createOrUpdateUserProfile({ display_name: 'Test' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the upsert fails', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: MOCK_AUTH_USER },
      error: null,
    });
    const dbError = new Error('Unique constraint violation');
    buildFromChain({ data: null, error: dbError });

    await expect(createOrUpdateUserProfile({ display_name: 'Test' })).rejects.toThrow(
      'Unique constraint violation',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the profile row when the user is authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: MOCK_AUTH_USER } });
    buildFromChain({ data: MOCK_USER, error: null });

    const result = await getCurrentUser();

    expect(result).toEqual(MOCK_USER);
  });

  it('returns null when no auth user exists (signed out)', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } });

    const result = await getCurrentUser();

    expect(result).toBeNull();
    // Should not query the users table at all
    expect(mockFromChain).not.toHaveBeenCalled();
  });

  it('returns null on PGRST116 (pre-onboarding — no profile row yet)', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: MOCK_AUTH_USER } });
    buildFromChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } });

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it('throws on other database errors', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: MOCK_AUTH_USER } });
    const dbError = { code: 'PGRST301', message: 'Permission denied' };
    buildFromChain({ data: null, error: dbError });

    await expect(getCurrentUser()).rejects.toMatchObject({ code: 'PGRST301' });
  });
});
