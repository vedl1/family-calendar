/**
 * tests/integration/groups/joinGroup.test.ts
 * Real integration tests for group join flow against local Supabase (Docker).
 *
 * Prerequisite: run `supabase start` before executing this test file.
 * [VCH-49]
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'removed';
};

const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7W9fDQlnh1yugVhlRJ6KhhivWWyMkm5yTI0';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

function loadLocalSupabaseEnv(): Record<string, string> {
  const commands = ['supabase status -o env', 'npx supabase status -o env'];
  for (const cmd of commands) {
    try {
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const pairs = output
        .split('\n')
        .filter((line) => line.includes('=') && !line.startsWith('Stopped services:'))
        .map((line) => {
          const idx = line.indexOf('=');
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
          return [key, value] as const;
        });
      if (pairs.length > 0) return Object.fromEntries(pairs);
    } catch {
      // Try next command candidate.
    }
  }
  return {};
}

const localEnv = loadLocalSupabaseEnv();

const SUPABASE_URL =
  process.env.TEST_SUPABASE_URL
  ?? process.env.LOCAL_SUPABASE_URL
  ?? localEnv.API_URL
  ?? DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY
  ?? process.env.LOCAL_SUPABASE_ANON_KEY
  ?? localEnv.PUBLISHABLE_KEY
  ?? localEnv.ANON_KEY
  ?? DEFAULT_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.LOCAL_SUPABASE_SECRET_KEY
  ?? localEnv.SECRET_KEY
  ?? localEnv.SERVICE_ROLE_KEY
  ?? DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_AUTH_ADMIN_KEY =
  process.env.TEST_SUPABASE_AUTH_ADMIN_KEY
  ?? process.env.LOCAL_SUPABASE_AUTH_ADMIN_KEY
  ?? localEnv.SERVICE_ROLE_KEY
  ?? process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
  ?? DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

const memoryStorage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memoryStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: async (key: string) => {
      memoryStorage.delete(key);
    },
  },
}));

type GroupsModule = {
  joinGroupByInviteLink: (token: string) => Promise<void>;
};

type TestUser = {
  id: string;
  email: string;
  password: string;
  anonClient: SupabaseClient;
};

type TestContext = {
  creator: TestUser;
  member: TestUser;
  outsider: TestUser;
  groupId: string;
};

let dbAdminClient: SupabaseClient;
let authAdminClient: SupabaseClient;
let appSupabase: SupabaseClient;
let groupsModule: GroupsModule;

const createdAuthUserIds = new Set<string>();
const createdUserRowIds = new Set<string>();
const createdGroupIds = new Set<string>();
const seededShareLinkIds = new Set<string>();

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}@example.com`;
}

function randomToken(): string {
  return globalThis.crypto.randomUUID();
}

async function createTestUser(prefix: string): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const password = 'P@ssw0rd!1234';

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({ email, password });
  if (signUpError) throw signUpError;
  if (!signUpData.user) throw new Error('Failed to create test auth user');

  createdAuthUserIds.add(signUpData.user.id);

  const { error: profileError } = await dbAdminClient.from('users').upsert({
    id: signUpData.user.id,
    email,
    display_name: `Test ${prefix}`,
  });
  if (profileError) throw profileError;

  createdUserRowIds.add(signUpData.user.id);

  return { id: signUpData.user.id, email, password, anonClient };
}

async function runAsUser<T>(user: TestUser, fn: () => Promise<T>): Promise<T> {
  const { data, error } = await user.anonClient.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  if (!data.session) throw new Error('No anon session returned');

  const { error: setSessionError } = await appSupabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setSessionError) throw setSessionError;

  const { data: currentUserData, error: currentUserError } = await appSupabase.auth.getUser();
  if (currentUserError) throw currentUserError;
  if (currentUserData.user?.id !== user.id) {
    throw new Error(`Session mismatch for ${user.email}`);
  }

  try {
    return await fn();
  } finally {
    await appSupabase.auth.signOut();
    await user.anonClient.auth.signOut();
  }
}

async function createGroup(createdBy: string, name: string): Promise<string> {
  const { data, error } = await dbAdminClient
    .from('groups')
    .insert({ name, created_by: createdBy })
    .select('id')
    .single();

  if (error) throw error;
  createdGroupIds.add(data.id as string);
  return data.id as string;
}

async function addMember(params: {
  groupId: string;
  userId: string;
  role: 'admin' | 'member';
  status?: 'pending' | 'active' | 'removed';
}): Promise<void> {
  const { error } = await dbAdminClient.from('group_members').upsert(
    {
      group_id: params.groupId,
      user_id: params.userId,
      role: params.role,
      status: params.status ?? 'active',
    },
    { onConflict: 'group_id,user_id' },
  );
  if (error) throw error;
}

async function createBaseContext(): Promise<TestContext> {
  const creator = await createTestUser('creator');
  const member = await createTestUser('member');
  const outsider = await createTestUser('outsider');

  const groupId = await createGroup(creator.id, `Group ${Date.now()}`);
  await addMember({ groupId, userId: creator.id, role: 'admin', status: 'active' });
  await addMember({ groupId, userId: member.id, role: 'member', status: 'active' });

  return { creator, member, outsider, groupId };
}

async function seedShareLink(params: {
  groupId: string;
  createdBy: string;
  token?: string;
  expiresAt?: string | null;
  revoked?: boolean;
}): Promise<string> {
  const token = params.token ?? randomToken();
  const { data, error } = await dbAdminClient
    .from('share_links')
    .insert({
      group_id: params.groupId,
      created_by: params.createdBy,
      token,
      expires_at: params.expiresAt ?? null,
      revoked: params.revoked ?? false,
    })
    .select('id')
    .single();

  if (error) throw error;
  seededShareLinkIds.add(data.id as string);
  return token;
}

async function cleanupCreatedData() {
  if (seededShareLinkIds.size > 0) {
    const shareLinkIds = [...seededShareLinkIds];
    const { error } = await dbAdminClient.from('share_links').delete().in('id', shareLinkIds);
    if (error) throw error;
    seededShareLinkIds.clear();
  }

  if (createdGroupIds.size > 0) {
    const groupIds = [...createdGroupIds];
    const { error: membersError } = await dbAdminClient.from('group_members').delete().in('group_id', groupIds);
    if (membersError) throw membersError;

    const { error: groupsError } = await dbAdminClient.from('groups').delete().in('id', groupIds);
    if (groupsError) throw groupsError;
    createdGroupIds.clear();
  }

  if (createdUserRowIds.size > 0) {
    const userIds = [...createdUserRowIds];
    const { error } = await dbAdminClient.from('users').delete().in('id', userIds);
    if (error) throw error;
    createdUserRowIds.clear();
  }

  if (createdAuthUserIds.size > 0) {
    for (const userId of createdAuthUserIds) {
      const { error } = await authAdminClient.auth.admin.deleteUser(userId);
      if (error && !error.message.includes('invalid JWT')) throw error;
    }
    createdAuthUserIds.clear();
  }
}

beforeAll(async () => {
  dbAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  authAdminClient = createClient(SUPABASE_URL, SUPABASE_AUTH_ADMIN_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error: healthError } = await dbAdminClient.from('users').select('id').limit(1);
  if (healthError) {
    throw new Error(
      `Cannot reach local Supabase at ${SUPABASE_URL}. Start it with \`supabase start\`. ${healthError.message}`,
    );
  }

  vi.resetModules();
  const supabaseModule = await vi.importActual('@/lib/supabase');
  const importedGroups = await vi.importActual('@/lib/groups');
  appSupabase = (supabaseModule as { supabase: SupabaseClient }).supabase;
  groupsModule = importedGroups as GroupsModule;
}, 30_000);

afterEach(async () => {
  if (appSupabase) {
    await appSupabase.auth.signOut();
  }
  await cleanupCreatedData();
});

afterAll(async () => {
  if (appSupabase) {
    await appSupabase.auth.signOut();
  }
  await cleanupCreatedData();
});

describe('lib/groups joinGroupByInviteLink integration', () => {
  it('valid token: outsider joins successfully and row is active', async () => {
    const ctx = await createBaseContext();
    const token = await seedShareLink({ groupId: ctx.groupId, createdBy: ctx.creator.id });

    await expect(
      runAsUser(ctx.outsider, () => groupsModule.joinGroupByInviteLink(token)),
    ).resolves.toBeUndefined();

    const { data, error } = await dbAdminClient
      .from('group_members')
      .select('group_id, user_id, status')
      .eq('group_id', ctx.groupId)
      .eq('user_id', ctx.outsider.id)
      .single();
    if (error) throw error;

    expect(data.group_id).toBe(ctx.groupId);
    expect(data.user_id).toBe(ctx.outsider.id);
    expect(data.status).toBe('active');
  });

  it('already a member: calling twice is idempotent and does not duplicate rows', async () => {
    const ctx = await createBaseContext();
    const token = await seedShareLink({ groupId: ctx.groupId, createdBy: ctx.creator.id });

    await expect(runAsUser(ctx.member, () => groupsModule.joinGroupByInviteLink(token))).resolves.toBeUndefined();
    await expect(runAsUser(ctx.member, () => groupsModule.joinGroupByInviteLink(token))).resolves.toBeUndefined();

    const { data, error } = await dbAdminClient
      .from('group_members')
      .select('id, group_id, user_id, status')
      .eq('group_id', ctx.groupId)
      .eq('user_id', ctx.member.id);
    if (error) throw error;

    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('active');
  });

  it('expired token: throws', async () => {
    const ctx = await createBaseContext();
    const token = await seedShareLink({
      groupId: ctx.groupId,
      createdBy: ctx.creator.id,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(
      runAsUser(ctx.outsider, () => groupsModule.joinGroupByInviteLink(token)),
    ).rejects.toThrow();
  });

  it('invalid token: throws', async () => {
    const ctx = await createBaseContext();

    await expect(
      runAsUser(ctx.outsider, () => groupsModule.joinGroupByInviteLink(randomToken())),
    ).rejects.toThrow();
  });

  it('revoked token: throws', async () => {
    const ctx = await createBaseContext();
    const token = await seedShareLink({
      groupId: ctx.groupId,
      createdBy: ctx.creator.id,
      revoked: true,
    });

    await expect(
      runAsUser(ctx.outsider, () => groupsModule.joinGroupByInviteLink(token)),
    ).rejects.toThrow();
  });

  it('RLS visibility: newly joined user can see their own group_members row', async () => {
    const ctx = await createBaseContext();
    const token = await seedShareLink({ groupId: ctx.groupId, createdBy: ctx.creator.id });

    await runAsUser(ctx.outsider, () => groupsModule.joinGroupByInviteLink(token));

    const visibleRows = await runAsUser(ctx.outsider, async () => {
      const { data, error } = await appSupabase
        .from('group_members')
        .select('id, group_id, user_id, role, status')
        .eq('group_id', ctx.groupId)
        .eq('user_id', ctx.outsider.id);
      if (error) throw error;
      return (data ?? []) as GroupMemberRow[];
    });

    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0].group_id).toBe(ctx.groupId);
    expect(visibleRows[0].user_id).toBe(ctx.outsider.id);
    expect(visibleRows[0].status).toBe('active');
  });
});
