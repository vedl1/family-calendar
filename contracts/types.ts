/**
 * contracts/types.ts — Single source of truth for all shared TypeScript types.
 * No agent may redefine these types elsewhere.
 * Changes require orchestrator approval (see AGENTS.md §4).
 */

// ============================================================
// ENUMS
// ============================================================

export type Importance = 'fyi' | 'recommend' | 'important' | 'critical';
export type MemberRole = 'member' | 'admin';
export type MemberStatus = 'pending' | 'active' | 'removed';
export type RSVPStatus = 'attending' | 'declined';

// ============================================================
// IMPORTANCE CONFIG (REQ-17, Appendix)
// ============================================================

export interface ImportanceConfig {
  /** Display label shown in UI (e.g. legend, tooltips) */
  label: string;
  /** Hex colour code */
  colour: string;
  /** Shape rendered on calendar tiles */
  shape: 'circle' | 'triangle' | 'diamond' | 'star';
}

export const IMPORTANCE: Record<Importance, ImportanceConfig> = {
  fyi:       { label: 'FYI',       colour: '#9CA3AF', shape: 'circle'   },
  recommend: { label: 'Recommend', colour: '#3B82F6', shape: 'triangle' },
  important: { label: 'Important', colour: '#F59E0B', shape: 'diamond'  },
  critical:  { label: 'Critical',  colour: '#EF4444', shape: 'star'     },
};

// ============================================================
// DATABASE ROW TYPES
// Field names match DB schema exactly (snake_case).
// Nullable DB columns are typed as `string | null` etc.
// Date/time columns are strings (Supabase JS client serialises them).
// ============================================================

export interface User {
  id:           string;
  phone:        string | null;
  email:        string | null;
  display_name: string | null;
  avatar_url:   string | null;
  created_at:   string;
}

export interface Group {
  id:          string;
  name:        string;
  description: string | null;
  created_by:  string | null; // null if creator's account was deleted
  created_at:  string;
}

export interface GroupMember {
  id:        string;
  group_id:  string;
  user_id:   string;
  role:      MemberRole;
  status:    MemberStatus;
  joined_at: string;
}

export interface Event {
  id:            string;
  group_id:      string;
  created_by:    string | null; // null if creator's account was deleted
  title:         string;
  description:   string | null;
  importance:    Importance;
  location:      string | null;
  event_date:    string; // ISO date: YYYY-MM-DD
  start_time:    string | null; // HH:MM:SS
  duration_mins: number | null;
  is_recurring:  boolean;
  recurrence:    Record<string, unknown> | null;
  created_at:    string;
  updated_at:    string;
}

export interface RSVP {
  id:         string;
  event_id:   string;
  user_id:    string;
  status:     RSVPStatus;
  updated_at: string;
}

export interface ShareLink {
  id:         string;
  group_id:   string;
  token:      string;
  created_by: string | null; // null if creator's account was deleted
  expires_at: string | null;
  revoked:    boolean;
  created_at: string;
}

// ============================================================
// ENRICHED VIEW TYPES (for UI consumption)
// ============================================================

export type UserSummary = Pick<User, 'id' | 'display_name' | 'avatar_url'>;

export interface EventWithMeta extends Event {
  creator: UserSummary;
  rsvps: (RSVP & { user: UserSummary })[];
}
