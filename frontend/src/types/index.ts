// types.ts

export type Role = "user" | "creator" | "owner";
export type Difficulty = "easy" | "medium" | "hard";
export type ProblemType = "classification" | "regression" | "other"; // Added 'other' for flexibility
export type Direction = "maximize" | "minimize";
export type AuthMode = "login" | "signup";
export type Page = "problems" | "problem-detail" | "my-submissions" | "profile" | "admin" | "problem-editor" | "settings";
export type CurrentView = "loading" | "auth" | "main";

export interface User {
    id: number;
    username: string;
    email: string;
    role: Role;
    joinedAt: string; // ISO date string
    avatarColor?: string;
    avatarUrl?: string | null; // Allow null for avatar
    profile: UserProfile;
    isBanned: boolean;
    // passwordHash should NEVER be sent to frontend
}

export interface UserProfile {
    realName?: string | null;
    gender?: 'Male' | 'Female' | 'Other' | null;
    country?: string | null;
    birthday?: string | null; // YYYY-MM-DD
    summary?: string | null;
    website?: string | null;
    github?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    skills?: string[];
    education?: Education[];
    workExperience?: WorkExperience[];
    allowJobContact?: boolean;
    showOnLeaderboard?: boolean;
    showSubmissionHistory?: boolean;
    notifications?: NotificationPreferences;
}

export interface Education {
    id: number; // Or string if using UUIDs
    school: string;
    degree: string;
    duration: string; // e.g., "2018 - 2022"
}

export interface WorkExperience {
    id: number; // Or string
    title: string;
    company: string;
    duration: string; // e.g., "2022 - Nay"
}


export interface NotificationPreferences {
    award?: { site: boolean; email: boolean };
    promotions?: { site: boolean; email: boolean };
    newComments?: { site: boolean; email: boolean };
    announcements?: { site: boolean; email: boolean };
    contestUpdates?: { site: boolean; email: boolean };
    featureAnnouncements?: { site: boolean; email: boolean };
}


export interface Tag {
    id: number;
    name: string;
}

export interface Metric {
    id: number;
    key: string; // e.g., 'accuracy', 'rmse'
    direction: Direction;
}

export interface Dataset {
    split: 'train' | 'public_test' | 'private_test' | string; // Allow custom splits, but define common ones
    filename: string;
    content?: string; // Content might be stored elsewhere in production
    downloadUrl?: string;
    // Add other metadata like size, rows, columns if needed
}


export interface Problem {
    id: number;
    name: string;
    difficulty: Difficulty;
    content: string; // Markdown content describing the problem
    problemType: ProblemType;
    authorId?: number | null; // Can be null if author deleted
    authorUsername?: string; // Included from backend join
    createdAt: string; // ISO date string
    datasets: Dataset[]; // Array containing metadata or full data
    tags: number[]; // Array of Tag IDs
    metrics: number[]; // Array of Metric IDs (for display purposes)
    evaluationScript?: string | null; // The Python script content for evaluation
    groundTruthContent?: string | null; // Content of the ground truth file
    // Optional: Add fields like participant count, submission count
    hasEvaluationScript?: boolean; // Indicate if script exists (derived in backend)
    hasGroundTruth?: boolean; // Indicate if ground truth exists (derived in backend)
    metricsLinks?: { metricId: number; isPrimary: boolean }[]; // Info about which metric is primary
}

export interface Submission {
    id: number;
    problemId: number;
    userId: number;
    username: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    publicScore?: number | null;
    runtimeMs?: number | null;
    submittedAt: string;
    problemName?: string;
    evaluationDetails?: { error?: string } | null;
}

export interface DiscussionPost {
    id: number;
    problemId: number;
    userId: number;
    username: string; // from join
    avatarColor?: string; // from join
    avatarUrl?: string | null; // from join
    title: string;
    content: string;
    createdAt: string; // ISO date string
    upvotedBy: number[];
    downvotedBy: number[];
}

export interface DiscussionComment {
    id: number;
    postId: number;
    parentId?: number | null; // Null for top-level comments
    userId: number;
    username: string; // from join
    avatarColor?: string; // from join
    avatarUrl?: string | null; // from join
    content: string;
    createdAt: string; // ISO date string
    upvotedBy: number[];
    downvotedBy: number[];
}

export interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

export interface LeaderboardEntry {
    rank?: number; // Optional because it's calculated on frontend
    username: string;
    score: number; // Assuming public score is used
    subId: number; // ID of the best submission
    time: string; // Submission time of the best submission
}

