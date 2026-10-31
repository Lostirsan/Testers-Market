export type Role = "user" | "moderator" | "admin";
export type AssignmentStatus =
  | "taken" | "submitted" | "accepted" | "rejected" | "disputed" | "rejected_final" | "expired" | "abandoned";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  itch_url: string | null;
  steam_url: string | null;
  role: Role;
  is_banned: boolean;
  starter_unlocked: boolean;
  created_at: string;
}

export interface Game {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  genre: string;
  platforms: string[];
  build_url: string;
  cover_url: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  game_id: string;
  owner_id: string;
  instructions: string;
  min_minutes: number;
  reward: number;
  fee: number;
  slots: number;
  accepted: number;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
}

export interface Assignment {
  id: string;
  campaign_id: string;
  tester_id: string;
  author_id: string;
  status: AssignmentStatus;
  taken_at: string;
  deadline_at: string;
  submitted_at: string | null;
  review_deadline_at: string | null;
  decided_at: string | null;
  dispute_deadline_at: string | null;
  quiz_attempts: number;
}

export interface Report {
  assignment_id: string;
  body: string;
  bugs: string | null;
  game_rating: number;
  media_urls: string[];
  author_score: number | null;
  reject_reason: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  kind: "starter" | "player" | "advertiser";
  code: string | null;
  title: string;
  description: string;
  reward: number;
  manual_review: boolean;
  action_url: string | null;
  advertiser: string | null;
  sort: number;
}

export interface Wallet {
  balance: number;
  locked: number;
  spendable: number;
  held: number;
}

export interface LedgerEntry {
  id: number;
  amount: number;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
}

export type ActionState = { error?: string; ok?: string } | undefined;
