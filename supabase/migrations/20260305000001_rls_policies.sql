-- Migration: 20260305000001_rls_policies.sql
-- Phase 0 — RLS policies for all 6 MVP tables
-- [VCH-25]

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- SECURITY DEFINER so they run as the definer (bypass RLS
-- internally) without granting elevated access to callers.
-- ============================================================

CREATE OR REPLACE FUNCTION is_active_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
      AND status   = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_group_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
      AND role     = 'admin'
      AND status   = 'active'
  );
$$;

-- ============================================================
-- TRIGGER: auto-insert creator as admin on group creation
-- Solves the chicken-and-egg problem: no admin exists yet to
-- satisfy the group_members INSERT policy when a group is new.
-- ============================================================

CREATE OR REPLACE FUNCTION on_group_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO group_members (group_id, user_id, role, status)
    VALUES (NEW.id, NEW.created_by, 'admin', 'active');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_group_created
  AFTER INSERT ON groups
  FOR EACH ROW
  EXECUTE FUNCTION on_group_created();

-- ============================================================
-- RPC: set_share_token
-- Client calls this before querying events with a share link.
-- Sets a transaction-scoped config var read by the events policy.
-- Usage: supabase.rpc('set_share_token', { p_token: '<uuid>' })
-- ============================================================

CREATE OR REPLACE FUNCTION set_share_token(p_token UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.share_token', p_token::text, true);
END;
$$;

-- ============================================================
-- POLICIES: users
-- ============================================================

-- Any authenticated user can read all users (needed for display
-- names and avatars in guest lists / member management).
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own row (created on first sign-in).
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile.
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- POLICIES: groups
-- ============================================================

-- Only active members can see a group's row.
CREATE POLICY "groups_select_member"
  ON groups FOR SELECT
  TO authenticated
  USING (is_active_member(id));

-- Any authenticated user can create a group.
-- The on_group_created trigger handles inserting the creator as admin.
CREATE POLICY "groups_insert_authenticated"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only group admins can update group details.
CREATE POLICY "groups_update_admin"
  ON groups FOR UPDATE
  TO authenticated
  USING     (is_group_admin(id))
  WITH CHECK (is_group_admin(id));

-- ============================================================
-- POLICIES: group_members
-- ============================================================

-- Active members can see all members of their group.
CREATE POLICY "group_members_select_member"
  ON group_members FOR SELECT
  TO authenticated
  USING (is_active_member(group_id));

-- Admins can add members (invite flow).
-- Note: creator's first membership is handled by the trigger above.
CREATE POLICY "group_members_insert_admin"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_group_admin(group_id));

-- Admins can update any member (role / status changes).
-- Members can update their own row (e.g. accepting a pending invite).
CREATE POLICY "group_members_update_admin_or_self"
  ON group_members FOR UPDATE
  TO authenticated
  USING     (is_group_admin(group_id) OR auth.uid() = user_id)
  WITH CHECK (is_group_admin(group_id) OR auth.uid() = user_id);

-- Only admins can remove members.
CREATE POLICY "group_members_delete_admin"
  ON group_members FOR DELETE
  TO authenticated
  USING (is_group_admin(group_id));

-- ============================================================
-- POLICIES: events
-- ============================================================

-- Active group members can read events.
-- Unauthenticated users with a valid share link token can also read.
CREATE POLICY "events_select_member_or_share_link"
  ON events FOR SELECT
  USING (
    is_active_member(group_id)
    OR EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.group_id = events.group_id
        AND share_links.token    = NULLIF(current_setting('app.share_token', true), '')::uuid
        AND share_links.revoked  = false
        AND (share_links.expires_at IS NULL OR share_links.expires_at > NOW())
    )
  );

-- Any active member can create events in their group.
CREATE POLICY "events_insert_member"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (is_active_member(group_id));

-- Any active member can update events (creator/admin enforcement is app-layer per REQ-16).
CREATE POLICY "events_update_member"
  ON events FOR UPDATE
  TO authenticated
  USING     (is_active_member(group_id))
  WITH CHECK (is_active_member(group_id));

-- Any active member can delete events (creator/admin enforcement is app-layer per REQ-16).
CREATE POLICY "events_delete_member"
  ON events FOR DELETE
  TO authenticated
  USING (is_active_member(group_id));

-- ============================================================
-- POLICIES: rsvps
-- ============================================================

-- Active members of the event's group can read all RSVPs.
CREATE POLICY "rsvps_select_member"
  ON rsvps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = rsvps.event_id
        AND is_active_member(events.group_id)
    )
  );

-- Users can only RSVP as themselves.
CREATE POLICY "rsvps_insert_own"
  ON rsvps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own RSVP.
CREATE POLICY "rsvps_update_own"
  ON rsvps FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own RSVP.
CREATE POLICY "rsvps_delete_own"
  ON rsvps FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES: share_links
-- ============================================================

-- Anyone (including unauthenticated) can read share links.
-- Required so the client can validate a token before fetching events.
CREATE POLICY "share_links_select_anyone"
  ON share_links FOR SELECT
  USING (true);

-- Only group admins can create share links.
CREATE POLICY "share_links_insert_admin"
  ON share_links FOR INSERT
  TO authenticated
  WITH CHECK (is_group_admin(group_id));

-- Only group admins can update share links (e.g. revoke, change expiry).
CREATE POLICY "share_links_update_admin"
  ON share_links FOR UPDATE
  TO authenticated
  USING     (is_group_admin(group_id))
  WITH CHECK (is_group_admin(group_id));

-- Only group admins can delete share links.
CREATE POLICY "share_links_delete_admin"
  ON share_links FOR DELETE
  TO authenticated
  USING (is_group_admin(group_id));
