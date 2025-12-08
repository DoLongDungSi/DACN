export type Role = "user" | "creator" | "owner" | "admin";
export type Difficulty = "easy" | "medium" | "hard";
export type ProblemType = "classification" | "regression" | "other";
export type Direction = "maximize" | "minimize";
export type AuthMode = "login" | "signup";
export type Page = "problems" | "problem-detail" | "my-submissions" | "profile" | "admin" | "problem-editor" | "settings";
export type CurrentView = "loading" | "auth" | "main";
export type SubmissionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'format_error' | 'runtime_error';

export interface User {
    id: number;
    username: string;
    email: string;
    role: Role;
    joinedAt: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    profile: UserProfile;
    isBanned: boolean;
    isPremium?: boolean;
}

export interface UserProfile {
    realName?: string | null;
    gender?: 'Male' | 'Female' | 'Other' | null;
    country?: string | null;
    birthday?: string | null;
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
    id: number;
    school: string;
    degree: string;
    duration: string;
}

export interface WorkExperience {
    id: number;
    title: string;
    company: string;
    duration: string;
}

export interface NotificationPreferences {
    award?: { site: boolean; email: boolean };
    promotions?: { site: boolean; email: boolean };
    newComments?: { site: boolean; email: boolean };
    announcements?: { site: boolean; email: boolean };
    contestUpdates?: { site: boolean; email: boolean };
    featureAnnouncements?: { site: boolean; email: boolean };
}

export interface Tag { id: number; name: string; }
export interface Metric { id: number; key: string; direction: Direction; }

export interface Dataset {
    split: string;
    fileName: string;
    downloadUrl?: string;
    sizeBytes?: number | null;
}

export interface DatasetFile {
    split: string;
    path: string;
    fileName: string;
    originalName: string;
    size: number;
}

export interface Problem {
    id: number;
    name: string;
    difficulty: Difficulty;
    content: string;
    summary?: string | null;
    dataDescription?: string | null;
    prizes?: string | null;
    isFrozen: boolean;
    isDeleted: boolean;
    problemType: ProblemType;
    authorId?: number | null;
    authorUsername?: string;
    authorAvatar?: string;
    createdAt: string;
    updatedAt: string;
    datasets: DatasetFile[];
    tags: Tag[];
    metrics: Metric[];
    evaluationScript?: string | null;
    coverImageUrl?: string | null;
}


export interface Submission {
    id: number;
    problemId: number;
    userId: number;
    username: string;
    status: SubmissionStatus;
    publicScore?: number | null;
    privateScore?: number | null;
    runtimeMs?: number | null;
    submittedAt: string;
    evaluatedAt?: string | null;
    filePath?: string | null;
    evaluationDetails?: Record<string, unknown>;
    isOfficial: boolean;
}

export interface DiscussionPost {
    id: number;
    problemId: number;
    userId: number;
    username: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    title: string;
    content: string;
    createdAt: string;
    upvotedBy: number[];
    downvotedBy: number[];
}

export interface DiscussionComment {
    id: number;
    postId: number;
    parentId?: number | null;
    userId: number;
    username: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    content: string;
    createdAt: string;
    upvotedBy: number[];
    downvotedBy: number[];
}

export interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

export interface Subscription {
    id: number;
    plan: string;
    status: string;
    startedAt?: string;
    renewsAt?: string | null;
}

export interface Invoice {
    id: number;
    invoiceNumber?: string;
    amountCents: number;
    currency: string;
    status: string;
    issuedAt: string;
    pdfPath?: string | null;
}

export interface Payment {
    id: number;
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
}

export interface LeaderboardEntry {
    rank?: number;
    username: string;
    avatarColor?: string;
    score: number;
    subId: number;
    time: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface LoadingState {
    isLoading: boolean;
    error?: string | null;
}

export interface ProblemDetailState extends LoadingState {
    problem: Problem | null;
    submissions: Submission[];
    leaderboard: LeaderboardEntry[];
}
