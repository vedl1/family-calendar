-- Migration: 20260302000000_initial_schema.sql
-- Phase 0 — Foundation: all 6 MVP tables, constraints, indexes, and triggers
-- [VCH-22]

-- ============================================================
-- UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: groups
-- ============================================================
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: group_members
-- ============================================================
CREATE TABLE group_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  status     TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- ============================================================
-- TABLE: events
-- ============================================================
CREATE TABLE events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  title          TEXT        NOT NULL,
  description    TEXT        CHECK (char_length(description) <= 120),
  importance     TEXT        NOT NULL DEFAULT 'fyi' CHECK (importance IN ('fyi', 'recommend', 'important', 'critical')),
  location       TEXT,
  event_date     DATE        NOT NULL,
  start_time     TIME,
  duration_mins  INTEGER     CHECK (duration_mins > 0),
  is_recurring   BOOLEAN     NOT NULL DEFAULT FALSE,
  recurrence     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: rsvps
-- ============================================================
CREATE TABLE rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL CHECK (status IN ('attending', 'declined')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ============================================================
-- TABLE: share_links
-- ============================================================
CREATE TABLE share_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token      UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_group_members_group_id ON group_members (group_id);
CREATE INDEX idx_events_group_id_event_date ON events (group_id, event_date);
CREATE INDEX idx_share_links_token ON share_links (token);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rsvps_updated_at
  BEFORE UPDATE ON rsvps
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
