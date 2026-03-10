-- Migration: 20260310000001_group_members_share_link_join.sql
-- Fix: allow authenticated users to join a group via valid share link.
-- The existing group_members_insert_admin policy only permits admins;
-- this additive policy enables the share-link join flow.
-- [VCH-53]

-- Allow authenticated users to join a group using a valid share link.
-- They may only insert a row for themselves (user_id = auth.uid()).
CREATE POLICY "group_members_insert_via_share_link"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.group_id = group_members.group_id
        AND share_links.revoked  = false
        AND (share_links.expires_at IS NULL OR share_links.expires_at > NOW())
    )
  );
