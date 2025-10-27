// Define all your TypeScript types here

export type Role = "owner" | "creator" | "user";
export type Difficulty = "easy" | "medium" | "hard";
export type ProblemType = "classification" | "regression";
export type Direction = "maximize" | "minimize";

export interface Metric {
  id: number;
  key: string;
  direction: Direction;
}

export interface Dataset {
  split: "train" | "public_test";
  filename: string;
  content: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Problem {
  id: number;
  name: string;
  difficulty: Difficulty;
  content: string;
  metrics: number[]; // Array of metric IDs
  problemType: ProblemType;
  tags: number[]; // Array of tag IDs
  authorId: number;
  authorUsername: string;
  datasets?: Dataset[];
}

export interface WorkExperience {
  id: number;
  title: string;
  company: string;
  duration: string;
}

export interface Education {
  id: number;
  school: string;
  degree: string;
  duration: string;
}

export interface NotificationPreferences {
  [key: string]: { email: boolean; site: boolean };
}

export interface UserProfile {
  realName?: string;
  gender?: "Male" | "Female" | "Other";
  country?: string;
  birthday?: string;
  summary?: string;
  website?: string;
  github?: string;
  twitter?: string;
  linkedin?: string;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
  allowJobContact: boolean;
  showOnLeaderboard: boolean;
  showSubmissionHistory: boolean;
  notifications: NotificationPreferences;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  joinedAt?: string; // Should be string if coming from backend
  avatarColor?: string;
  avatarUrl?: string;
  profile: UserProfile;
  isBanned?: boolean;
}

export interface Submission {
  id: number;
  problemId: number;
  userId: number;
  username: string; // Added username based on initial data fetching
  status: "succeeded" | "failed" | "pending" | "running"; // Assuming other statuses might exist
  publicScore: number;
  runtimeMs: number;
  submittedAt: string; // Should be string if coming from backend
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  subId: number;
  time: string; // Should be string if coming from backend
  rank?: number;
}

export interface DiscussionComment {
  id: number;
  postId: number;
  parentId: number | null;
  userId: number;
  username: string;
  avatarColor: string;
  avatarUrl?: string;
  content: string;
  createdAt: string; // Should be string if coming from backend
  upvotedBy: number[];
  downvotedBy: number[];
}

export interface DiscussionPost {
  id: number;
  problemId: number;
  userId: number;
  username: string;
  avatarColor: string;
  avatarUrl?: string;
  title: string;
  content: string;
  createdAt: string; // Should be string if coming from backend
  upvotedBy: number[];
  downvotedBy: number[];
}

// Add other types as needed
export type Page =
  | "problems"
  | "my-submissions"
  | "problem-detail"
  | "profile"
  | "admin"
  | "problem-editor"
  | "settings";

export type AuthMode = "login" | "signup";

export type AppView = "loading" | "auth" | "main";

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}
