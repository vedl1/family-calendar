/**
 * tests/integration/events.test.ts
 * Real integration tests for lib/events.ts against local Supabase (Docker).
 *
 * Prerequisite: run `supabase start` before executing this test file.
 * [VCH-47]
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Event, EventWithMeta, RSVP } from '@/contracts/types';

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
      if (pairs.length > 0) {
        return Object.fromEntries(pairs);
      }
    } catch {
      // Continue to next command candidate.
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

type EventsModule = {
  createEvent: (params: {
    group_id: string;
    title: string;
    start_at: string;
    end_at: string;
    importance: 'fyi' | 'recommend' | 'important' | 'critical';
    description?: string;
    location?: string;
  }) => Promise<Event>;
  getEvents: (groupId: string, from: string, to: string) => Promise<EventWithMeta[]>;
  updateEvent: (
    eventId: string,
    params: Partial<Omit<Event, 'id' | 'group_id' | 'created_by' | 'created_at'>>,
  ) => Promise<Event>;
  deleteEvent: (eventId: string) => Promise<void>;
  upsertRSVP: (eventId: string, status: 'attending' | 'declined') => Promise<RSVP>;
  removeRSVP: (eventId: string) => Promise<void>;
  subscribeToEvents: (groupId: string, callback: (event: Event) => void) => RealtimeChannel;
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

let adminClient: SupabaseClient;
let appSupabase: SupabaseClient;
let eventsModule: EventsModule;

const createdUserRowIds = new Set<string>();
const createdGroupIds = new Set<string>();

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}@example.com`;
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

  const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
    email,
    password,
  });
  if (signUpError) throw signUpError;
  if (!signUpData.user) throw new Error('Failed to create test auth user');

  const { error: profileError } = await adminClient.from('users').upsert({
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

  try {
    return await fn();
  } finally {
    await appSupabase.auth.signOut();
    await user.anonClient.auth.signOut();
  }
}

async function createGroup(createdBy: string, name: string): Promise<string> {
  const { data, error } = await adminClient
    .from('groups')
    .insert({ name, created_by: createdBy })
    .select('id')
    .single();

  if (error) throw error;
  createdGroupIds.add(data.id);
  return data.id as string;
}

async function addActiveMember(groupId: string, userId: string, role: 'admin' | 'member' = 'member') {
  const { error } = await adminClient.from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role,
    status: 'active',
  });
  if (error) throw error;
}

async function createBaseContext(): Promise<TestContext> {
  const creator = await createTestUser('creator');
  const member = await createTestUser('member');
  const outsider = await createTestUser('outsider');

  const groupId = await createGroup(creator.id, `Group ${Date.now()}`);
  await addActiveMember(groupId, member.id, 'member');

  return { creator, member, outsider, groupId };
}

async function insertEventWithCreator(params: {
  groupId: string;
  createdBy: string;
  title: string;
  eventDate: string;
  startTime?: string;
  durationMins?: number;
}): Promise<Event> {
  const { data, error } = await adminClient
    .from('events')
    .insert({
      group_id: params.groupId,
      created_by: params.createdBy,
      title: params.title,
      importance: 'fyi',
      event_date: params.eventDate,
      start_time: params.startTime ?? '10:00:00',
      duration_mins: params.durationMins ?? 60,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Event;
}

async function cleanupCreatedData() {
  if (createdGroupIds.size > 0) {
    const groupIds = [...createdGroupIds];
    const { error } = await adminClient.from('groups').delete().in('id', groupIds);
    if (error) throw error;
    createdGroupIds.clear();
  }

  if (createdUserRowIds.size > 0) {
    const userIds = [...createdUserRowIds];
    const { error } = await adminClient.from('users').delete().in('id', userIds);
    if (error) throw error;
    createdUserRowIds.clear();
  }
}

beforeAll(async () => {
  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error: healthError } = await adminClient.from('users').select('id').limit(1);
  if (healthError) {
    throw new Error(
      `Cannot reach local Supabase at ${SUPABASE_URL}. Start it with \`supabase start\`. ${healthError.message}`,
    );
  }

  const supabaseModule = await vi.importActual('@/lib/supabase');
  const importedEvents = await vi.importActual('@/lib/events');
  appSupabase = (supabaseModule as { supabase: SupabaseClient }).supabase;
  eventsModule = importedEvents as EventsModule;
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

describe('lib/events integration (local Supabase)', () => {
  describe('createEvent', () => {
    it('creates an event with required fields and returns event_date/start_time/duration_mins', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'School pickup',
          start_at: '2026-03-12T09:30:00.000Z',
          end_at: '2026-03-12T11:00:00.000Z',
          importance: 'important',
          description: 'Bring sports kit',
        }),
      );

      expect(created.group_id).toBe(ctx.groupId);
      expect(created.title).toBe('School pickup');
      expect(created.event_date).toBe('2026-03-12');
      expect(created.start_time).toBe('09:30:00');
      expect(created.duration_mins).toBe(90);
    });

    it('calculates duration_mins from start_at/end_at', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Dentist',
          start_at: '2026-03-15T14:05:00.000Z',
          end_at: '2026-03-15T14:50:00.000Z',
          importance: 'fyi',
        }),
      );

      expect(created.duration_mins).toBe(45);
    });

    it('stores description as null when not provided', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Library',
          start_at: '2026-03-20T10:00:00.000Z',
          end_at: '2026-03-20T11:00:00.000Z',
          importance: 'recommend',
        }),
      );

      expect(created.description).toBeNull();
    });
  });

  describe('getEvents', () => {
    it('returns only events in requested group/date range and includes creator/rsvps', async () => {
      const ctx = await createBaseContext();
      const otherGroupId = await createGroup(ctx.creator.id, `Other ${Date.now()}`);

      const inRange = await insertEventWithCreator({
        groupId: ctx.groupId,
        createdBy: ctx.creator.id,
        title: 'In range',
        eventDate: '2026-04-10',
      });

      await insertEventWithCreator({
        groupId: otherGroupId,
        createdBy: ctx.creator.id,
        title: 'Different group',
        eventDate: '2026-04-10',
      });

      await insertEventWithCreator({
        groupId: ctx.groupId,
        createdBy: ctx.creator.id,
        title: 'Outside range',
        eventDate: '2026-04-25',
      });

      const { error: rsvpError } = await adminClient.from('rsvps').insert({
        event_id: inRange.id,
        user_id: ctx.member.id,
        status: 'attending',
      });
      if (rsvpError) throw rsvpError;

      const events = await runAsUser(ctx.member, () =>
        eventsModule.getEvents(ctx.groupId, '2026-04-01', '2026-04-15'),
      );

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(inRange.id);
      expect(events[0]).toHaveProperty('creator');
      expect((events[0] as EventWithMeta).creator.id).toBe(ctx.creator.id);
      expect(Array.isArray((events[0] as EventWithMeta).rsvps)).toBe(true);
      expect((events[0] as EventWithMeta).rsvps[0]?.user.id).toBe(ctx.member.id);
    });
  });

  describe('updateEvent', () => {
    it('allows creator to update own event', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Original title',
          start_at: '2026-05-01T08:00:00.000Z',
          end_at: '2026-05-01T09:00:00.000Z',
          importance: 'important',
        }),
      );

      const updated = await runAsUser(ctx.creator, () =>
        eventsModule.updateEvent(created.id, { title: 'Updated title' }),
      );

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('Updated title');
    });

    it('blocks updates from non-member (RLS)', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Locked event',
          start_at: '2026-05-02T08:00:00.000Z',
          end_at: '2026-05-02T09:00:00.000Z',
          importance: 'fyi',
        }),
      );

      await expect(
        runAsUser(ctx.outsider, () => eventsModule.updateEvent(created.id, { title: 'Should fail' })),
      ).rejects.toBeTruthy();
    });
  });

  describe('deleteEvent', () => {
    it('allows creator to delete own event', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Delete me',
          start_at: '2026-05-03T08:00:00.000Z',
          end_at: '2026-05-03T09:00:00.000Z',
          importance: 'fyi',
        }),
      );

      await runAsUser(ctx.creator, () => eventsModule.deleteEvent(created.id));

      const { data, error } = await adminClient.from('events').select('id').eq('id', created.id).maybeSingle();
      if (error) throw error;
      expect(data).toBeNull();
    });

    it('prevents delete by non-creator/non-admin user (event remains)', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Protected event',
          start_at: '2026-05-04T08:00:00.000Z',
          end_at: '2026-05-04T09:00:00.000Z',
          importance: 'important',
        }),
      );

      await runAsUser(ctx.outsider, () => eventsModule.deleteEvent(created.id));

      const { data, error } = await adminClient.from('events').select('id').eq('id', created.id).maybeSingle();
      if (error) throw error;
      expect(data?.id).toBe(created.id);
    });
  });

  describe('upsertRSVP', () => {
    it('creates attending RSVP then updates same row to declined', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'RSVP event',
          start_at: '2026-05-05T08:00:00.000Z',
          end_at: '2026-05-05T09:00:00.000Z',
          importance: 'recommend',
        }),
      );

      const first = await runAsUser(ctx.member, () => eventsModule.upsertRSVP(created.id, 'attending'));
      const second = await runAsUser(ctx.member, () => eventsModule.upsertRSVP(created.id, 'declined'));

      expect(first.status).toBe('attending');
      expect(second.status).toBe('declined');
      expect(second.id).toBe(first.id);

      const { data, error } = await adminClient
        .from('rsvps')
        .select('*')
        .eq('event_id', created.id)
        .eq('user_id', ctx.member.id);

      if (error) throw error;
      expect(data).toHaveLength(1);
    });
  });

  describe('removeRSVP', () => {
    it('removes current user RSVP; getEvents no longer includes it', async () => {
      const ctx = await createBaseContext();

      const created = await runAsUser(ctx.creator, () =>
        eventsModule.createEvent({
          group_id: ctx.groupId,
          title: 'Remove RSVP event',
          start_at: '2026-05-06T08:00:00.000Z',
          end_at: '2026-05-06T09:00:00.000Z',
          importance: 'fyi',
        }),
      );

      await runAsUser(ctx.member, () => eventsModule.upsertRSVP(created.id, 'attending'));
      await runAsUser(ctx.member, () => eventsModule.removeRSVP(created.id));

      const events = await runAsUser(ctx.member, () =>
        eventsModule.getEvents(ctx.groupId, '2026-05-01', '2026-05-31'),
      );

      const event = events.find((e) => e.id === created.id);
      expect(event).toBeDefined();
      expect(event?.rsvps.some((r: RSVP & { user: { id: string } }) => r.user.id === ctx.member.id)).toBe(false);
    });
  });

  describe('subscribeToEvents', () => {
    it('returns a RealtimeChannel and unsubscribe does not throw', async () => {
      const ctx = await createBaseContext();

      await runAsUser(ctx.creator, async () => {
        const channel = eventsModule.subscribeToEvents(ctx.groupId, () => undefined);

        expect(channel).toBeDefined();
        expect(typeof channel.unsubscribe).toBe('function');
        await expect(channel.unsubscribe()).resolves.toBeDefined();
      });
    });
  });
});
