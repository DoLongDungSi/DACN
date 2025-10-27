import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Crop, PixelCrop } from 'react-image-crop';
import {
    User, Problem, Tag, Metric, Submission, DiscussionPost, DiscussionComment,
    Page, AuthMode, CurrentView, ConfirmModalState, LeaderboardEntry, Dataset, Role, Direction, UserProfile, NotificationPreferences
} from '../types';
import { API_BASE_URL, OWNER_ID } from '../api';
import { getCroppedImg, centerCrop, makeAspectCrop } from '../utils';
import { format, parseISO, startOfDay, formatDistanceToNow } from 'date-fns';

// Define the shape of the context data
interface AppContextType {
    // State
    currentUser: User | null;
    users: User[];
    problems: Problem[];
    allTags: Tag[];
    allMetrics: Metric[];
    submissions: Submission[];
    posts: DiscussionPost[];
    comments: DiscussionComment[];
    leaderboardData: { [key: number]: LeaderboardEntry[] };
    page: Page;
    editingProblem: Problem | "new" | null;
    currentView: CurrentView;
    authMode: AuthMode;
    selectedProblem: Problem | null;
    viewingUserId: number | null;
    loading: boolean;
    error: string;
    confirmModal: ConfirmModalState | null;
    imgSrc: string;
    crop?: Crop;
    completedCrop?: PixelCrop;
    isAvatarModalOpen: boolean;
    originalFileName: string;
    imgRef: React.RefObject<HTMLImageElement>;
    problemHint: string | null;
    isGeneratingHint: boolean;
    leftPanelTab: 'description' | 'discussion' | 'datasets';
    rightPanelTab: 'leaderboard' | 'submissions';
    viewingPost: DiscussionPost | null;
    showNewPostModal: boolean;
    replyingTo: number | null;
    adminSubPage: 'users' | 'tags-metrics';
    toastMessage: string | null;
    toastType: 'success' | 'error' | 'info' | null;
    editingItemId: number | null; // ID of post/comment being edited
    editingItemType: 'post' | 'comment' | null; // Type of item being edited


    // Setters
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setProblems: React.Dispatch<React.SetStateAction<Problem[]>>;
    setAllTags: React.Dispatch<React.SetStateAction<Tag[]>>;
    setAllMetrics: React.Dispatch<React.SetStateAction<Metric[]>>;
    setSubmissions: React.Dispatch<React.SetStateAction<Submission[]>>;
    setPosts: React.Dispatch<React.SetStateAction<DiscussionPost[]>>;
    setComments: React.Dispatch<React.SetStateAction<DiscussionComment[]>>;
    setLeaderboardData: React.Dispatch<React.SetStateAction<{ [key: number]: LeaderboardEntry[] }>>;
    setPage: React.Dispatch<React.SetStateAction<Page>>;
    setEditingProblem: React.Dispatch<React.SetStateAction<Problem | "new" | null>>;
    setCurrentView: React.Dispatch<React.SetStateAction<CurrentView>>;
    setAuthMode: React.Dispatch<React.SetStateAction<AuthMode>>;
    setSelectedProblem: React.Dispatch<React.SetStateAction<Problem | null>>;
    setViewingUserId: React.Dispatch<React.SetStateAction<number | null>>;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setError: React.Dispatch<React.SetStateAction<string>>;
    setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState | null>>;
    setImgSrc: React.Dispatch<React.SetStateAction<string>>;
    setCrop: React.Dispatch<React.SetStateAction<Crop | undefined>>;
    setCompletedCrop: React.Dispatch<React.SetStateAction<PixelCrop | undefined>>;
    setIsAvatarModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setOriginalFileName: React.Dispatch<React.SetStateAction<string>>;
    setProblemHint: React.Dispatch<React.SetStateAction<string | null>>;
    setIsGeneratingHint: React.Dispatch<React.SetStateAction<boolean>>;
    setLeftPanelTab: React.Dispatch<React.SetStateAction<'description' | 'discussion' | 'datasets'>>;
    setRightPanelTab: React.Dispatch<React.SetStateAction<'leaderboard' | 'submissions'>>;
    setViewingPost: React.Dispatch<React.SetStateAction<DiscussionPost | null>>;
    setShowNewPostModal: React.Dispatch<React.SetStateAction<boolean>>;
    setReplyingTo: React.Dispatch<React.SetStateAction<number | null>>;
    setAdminSubPage: React.Dispatch<React.SetStateAction<'users' | 'tags-metrics'>>;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    clearToast: () => void;
    setEditingItemId: React.Dispatch<React.SetStateAction<number | null>>; // Setter for editing ID
    setEditingItemType: React.Dispatch<React.SetStateAction<'post' | 'comment' | null>>; // Setter for editing type

    // API Helper
    api: { get: (endpoint: string) => Promise<any>; post: (endpoint: string, body?: any) => Promise<any>; put: (endpoint: string, body?: any) => Promise<any>; delete: (endpoint: string) => Promise<any>; };

     // Action Handlers
    fetchAllData: () => Promise<void>;
    handleSignup: (username: string, email: string, password: string) => Promise<void>;
    handleLogin: (credential: string, password: string) => Promise<void>;
    handleLogout: () => Promise<void>;
    handleSaveProblem: (problemData: any, tagIds: number[], metricIds: number[], files: { trainFile: File | null, testFile: File | null }) => Promise<void>;
    handleDeleteProblem: (id: number) => void;
    handleSettingsUpdate: (updatedUserData: Pick<User, 'username' | 'email' | 'profile'>) => Promise<void>;
    handleChangePassword: (currentPass: string, newPass: string) => Promise<boolean>;
    handleDeleteAccount: () => void;
    handleAdminUpdateUserRole: (id: number, role: Role) => Promise<void>;
    handleAdminToggleBanUser: (id: number) => Promise<void>;
    handleAdminDeleteUser: (id: number) => void;
    handleAdminAddTag: (name: string) => Promise<void>;
    handleAdminDeleteTag: (id: number) => Promise<void>;
    handleAdminAddMetric: (key: string, direction: Direction) => Promise<void>;
    handleAdminDeleteMetric: (id: number) => Promise<void>;
    handlePostSubmit: (title: string, content: string) => Promise<void>;
    handleCommentSubmit: (postId: number, content: string, parentId: number | null) => Promise<void>;
    handleVote: (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => Promise<void>;
    handleGetHint: () => Promise<void>;
    downloadDataset: (content: string, filename: string) => void;
    openConfirmModal: (title: string, message: string, onConfirm: () => void) => void;
    closeConfirmModal: () => void;
    navigateToProfile: (userIdOrUsername: number | string) => void;
    handleProblemSubmit: (formData: FormData) => Promise<void>;
    handleAvatarUpdate: () => Promise<void>;
    handleUpdatePost: (postId: number, title: string, content: string) => Promise<void>; // New handler
    handleDeletePost: (postId: number) => void; // New handler (uses confirm modal)
    handleUpdateComment: (commentId: number, content: string) => Promise<void>; // New handler
    handleDeleteComment: (commentId: number) => void; // New handler (uses confirm modal)
}

// Create the context
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Define the provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- STATE HOOKS ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [allMetrics, setAllMetrics] = useState<Metric[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [posts, setPosts] = useState<DiscussionPost[]>([]);
    const [comments, setComments] = useState<DiscussionComment[]>([]);
    const [leaderboardData, setLeaderboardData] = useState<{ [key: number]: LeaderboardEntry[] }>({});
    const [page, setPage] = useState<Page>("problems");
    const [editingProblem, setEditingProblem] = useState<Problem | "new" | null>(null);
    const [currentView, setCurrentView] = useState<CurrentView>("loading");
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
    const [viewingUserId, setViewingUserId] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true); // Start loading true
    const [error, setError] = useState<string>("");
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [originalFileName, setOriginalFileName] = useState('avatar.png');
    const imgRef = useRef<HTMLImageElement>(null);
    const [problemHint, setProblemHint] = useState<string | null>(null);
    const [isGeneratingHint, setIsGeneratingHint] = useState(false);
    const [leftPanelTab, setLeftPanelTab] = useState<'description' | 'discussion' | 'datasets'>('description');
    const [rightPanelTab, setRightPanelTab] = useState<'leaderboard' | 'submissions'>('leaderboard');
    const [viewingPost, setViewingPost] = useState<DiscussionPost | null>(null);
    const [showNewPostModal, setShowNewPostModal] = useState(false);
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [adminSubPage, setAdminSubPage] = useState<'users' | 'tags-metrics'>('users');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'success' | 'error' | 'info' | null>(null);
    const [editingItemId, setEditingItemId] = useState<number | null>(null); // State for editing ID
    const [editingItemType, setEditingItemType] = useState<'post' | 'comment' | null>(null); // State for editing type


     // --- Toast Functions ---
     const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => { setToastMessage(message); setToastType(type); setError(''); }, []);
     const clearToast = useCallback(() => { setToastMessage(null); setToastType(null); }, []);

    // --- API HELPER ---
    const api = useMemo(() => {
        const request = async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) => {
            const url = `${API_BASE_URL}${endpoint}`;
            const options: RequestInit = { method, headers: {}, credentials: 'include' };
            if (body) { if (body instanceof FormData) options.body = body; else { (options.headers as Record<string, string>)['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); } }
            try {
                const response = await fetch(url, options);
                if (response.status === 204) return null;
                let data;
                try { data = await response.json(); } catch (jsonError) { if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`); console.warn("API OK but not JSON:", response.url); return null; }
                if (!response.ok) throw new Error(data.message || `API Error: ${response.status} ${response.statusText}`);
                return data;
            } catch (err: any) { console.error(`API Error on ${method} ${url}:`, err); showToast(err.message || 'Có lỗi không mong muốn xảy ra.', 'error'); throw err; }
        };
        return { get: (ep: string) => request(ep, 'GET'), post: (ep: string, b?: any) => request(ep, 'POST', b), put: (ep: string, b?: any) => request(ep, 'PUT', b), delete: (ep: string) => request(ep, 'DELETE'), };
    }, [showToast]);

    // --- ASYNC ACTION HANDLERS ---
     const fetchAllData = useCallback(async () => {
         // Keep loading true if it was already true (initial load)
         // setLoading(true); // Don't set loading true here for subsequent fetches
        try {
            const data = await api.get('/initial-data');
            setUsers(data.users || []);
            setProblems(data.problems || []);
            setAllTags(data.tags || []);
            setAllMetrics(data.metrics || []);
            setSubmissions(data.submissions || []);
            setPosts(data.posts || []);
            setComments(data.comments || []);
            console.log("Fetched initial data:", data); // Log fetched data
        } catch (e) {
             console.error("Failed to fetch initial data:", e);
             // Clear data on failure to avoid stale state
             setUsers([]); setProblems([]); setAllTags([]); setAllMetrics([]);
             setSubmissions([]); setPosts([]); setComments([]); setLeaderboardData({});
        } finally {
            // setLoading(false); // Only set loading false after INITIAL load (in useEffect)
        }
    }, [api]); // Dependencies: api only


    // --- Leaderboard Calculation Effect ---
     useEffect(() => {
         if (loading || !problems.length || !allMetrics.length) { return; } // Don't calculate if loading or no data
        const newLeaderboardData: { [key: number]: LeaderboardEntry[] } = {};
        try {
            problems.forEach((problem) => {
                if (problem?.id === undefined || problem?.id === null) return;
                const problemSubmissions = submissions.filter(s => s.problemId === problem.id && s.status === 'succeeded' && typeof s.publicScore === 'number' && s.submittedAt);
                const primaryMetricId = problem.metrics?.[0];
                const metric = primaryMetricId !== undefined ? allMetrics.find(m => m.id === primaryMetricId) : undefined;
                if (!metric || problemSubmissions.length === 0) { newLeaderboardData[problem.id] = []; return; }
                const bestScores = new Map<number, Submission>();
                problemSubmissions.forEach((sub) => {
                     try { parseISO(sub.submittedAt!); } catch { return; } // Ensure date is valid
                    const existingBest = bestScores.get(sub.userId);
                    if (!existingBest || typeof existingBest.publicScore !== 'number' || !existingBest.submittedAt) { bestScores.set(sub.userId, sub); return; }
                    const isNewScoreBetter = metric.direction === 'maximize' ? sub.publicScore! > existingBest.publicScore : sub.publicScore! < existingBest.publicScore;
                    const areScoresEqual = sub.publicScore === existingBest.publicScore;
                    const isEarlierSubmission = new Date(sub.submittedAt!).getTime() < new Date(existingBest.submittedAt).getTime();
                    if (isNewScoreBetter || (areScoresEqual && isEarlierSubmission)) { bestScores.set(sub.userId, sub); }
                });
                const sortedEntries: LeaderboardEntry[] = Array.from(bestScores.values())
                    .map(sub => ({ rank: 0, username: sub.username, score: sub.publicScore!, subId: sub.id, time: sub.submittedAt! })) // Added rank: 0 temporarily
                    .sort((a, b) => { const scoreDiff = metric.direction === 'maximize' ? b.score - a.score : a.score - b.score; if (scoreDiff !== 0) return scoreDiff; return new Date(a.time).getTime() - new Date(b.time).getTime(); });
                sortedEntries.forEach((entry, index) => { entry.rank = index + 1; });
                newLeaderboardData[problem.id] = sortedEntries;
            });
            setLeaderboardData(newLeaderboardData);
        } catch (error) {
            console.error("Error calculating leaderboard:", error);
            showToast("Lỗi khi tính toán bảng xếp hạng.", "error");
            setLeaderboardData({});
        }
     }, [submissions, problems, allMetrics, loading, showToast]); // Added loading dependency

    // --- Auth Handlers ---
     const handleSignup = useCallback(async (username: string, email: string, password: string) => { setLoading(true); try { const data = await api.post('/auth/signup', { username, email, password }); setCurrentUser(data.user); await fetchAllData(); setCurrentView('main'); setPage('problems'); showToast(`Chào mừng ${data.user.username}!`, 'success'); } catch (err) {} finally { setLoading(false); } }, [api, fetchAllData, showToast, setLoading, setCurrentUser, setCurrentView, setPage]);
     const handleLogin = useCallback(async (credential: string, password: string) => { setLoading(true); try { const data = await api.post('/auth/login', { credential, password }); setCurrentUser(data.user); await fetchAllData(); setCurrentView('main'); setPage('problems'); showToast(`Chào mừng trở lại, ${data.user.username}!`, 'success'); } catch (err) {} finally { setLoading(false); } }, [api, fetchAllData, showToast, setLoading, setCurrentUser, setCurrentView, setPage]);
     const handleLogout = useCallback(async () => { setLoading(true); try { await api.post('/auth/logout', {}); setCurrentUser(null); setUsers([]); setProblems([]); setSubmissions([]); setPosts([]); setComments([]); setLeaderboardData({}); setSelectedProblem(null); setViewingUserId(null); setCurrentView('auth'); setPage('problems'); setError(''); showToast("Đã đăng xuất.", 'info'); } catch (err) { showToast("Đăng xuất thất bại.", 'error'); } finally { setLoading(false); } }, [api, showToast, setLoading, setCurrentUser, setUsers, setProblems, setSubmissions, setPosts, setComments, setLeaderboardData, setSelectedProblem, setViewingUserId, setCurrentView, setPage, setError]);

     // --- Initial Session Check & Data Load ---
     useEffect(() => {
        const initializeApp = async () => {
            setLoading(true); // Ensure loading is true at the start
            try {
                const data = await api.get('/auth/check-session');
                setCurrentUser(data.user);
                await fetchAllData(); // Fetch all data after confirming session
                setCurrentView('main');
            } catch (e) {
                console.log("No active session or error checking session.");
                setCurrentUser(null);
                setCurrentView('auth');
                // No need to fetchAllData if not logged in
            } finally {
                setLoading(false); // Set loading false after everything is done
            }
        };
        initializeApp();
     }, [api, fetchAllData]); // Run only once on mount

    // --- Problem Handlers ---
    const handleSaveProblem = useCallback(async ( problemData: Partial<Problem>, tagIds: number[], metricIds: number[], files: { trainFile: File | null; testFile: File | null } ) => { if (!currentUser) { showToast("Bạn cần đăng nhập.", "error"); return; } setLoading(true); try { const formData = new FormData(); const currentDatasets = (editingProblem !== 'new' && editingProblem?.datasets) ? editingProblem.datasets : []; const dataToSend = { ...problemData, tagIds, metricIds, existingDatasets: currentDatasets, }; formData.append('problemData', JSON.stringify(dataToSend)); if (files.trainFile) formData.append('trainCsv', files.trainFile); if (files.testFile) formData.append('testCsv', files.testFile); if (editingProblem === 'new') { if (!files.trainFile || !files.testFile) throw new Error("Vui lòng tải lên cả file train và test."); const data = await api.post('/problems', formData); showToast("Tạo bài toán thành công!", "success"); } else if (editingProblem) { if (currentUser.role !== 'owner' && editingProblem.authorId !== currentUser.id) throw new Error("Không được phép sửa."); const data = await api.put(`/problems/${editingProblem.id}`, formData); showToast("Cập nhật bài toán thành công!", "success"); } await fetchAllData(); setEditingProblem(null); setPage('problems'); } catch (e) {} finally { setLoading(false); } }, [api, currentUser, editingProblem, fetchAllData, showToast, setLoading, setEditingProblem, setPage]);
    const openConfirmModal = useCallback((title: string, message: string, onConfirm: () => void) => { setConfirmModal({ isOpen: true, title, message, onConfirm }); }, [setConfirmModal]);
    const closeConfirmModal = useCallback(() => setConfirmModal(null), [setConfirmModal]);
     const handleDeleteProblem = useCallback((id: number) => { openConfirmModal("Xác nhận xóa", "Bạn chắc chắn muốn xóa bài toán này và mọi dữ liệu liên quan (bài nộp, thảo luận)? Hành động này không thể hoàn tác.", async () => { setLoading(true); try { await api.delete(`/problems/${id}`); await fetchAllData(); if (selectedProblem?.id === id) setSelectedProblem(null); showToast("Xóa bài toán thành công!", "success"); closeConfirmModal(); setPage('problems'); } catch (e) { closeConfirmModal(); /* Error shown by API helper */ } finally { setLoading(false); } }); }, [api, fetchAllData, openConfirmModal, closeConfirmModal, selectedProblem, showToast, setLoading, setSelectedProblem, setPage]);

    // --- Settings Handlers ---
    const handleSettingsUpdate = useCallback(async (updatedUserData: Pick<User, 'username' | 'email' | 'profile'>) => { if (!currentUser) return; setLoading(true); try { const data = await api.put('/users/me', updatedUserData); const updatedUser = data.user; setCurrentUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser); setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u)); showToast("Cập nhật thành công!", "success"); } catch (err) {} finally { setLoading(false); } }, [api, currentUser, showToast, setLoading, setCurrentUser, setUsers]);
    const handleChangePassword = useCallback(async (currentPass: string, newPass: string): Promise<boolean> => { setLoading(true); try { await api.post('/auth/change-password', { currentPassword: currentPass, newPassword: newPass }); showToast('Đổi mật khẩu thành công!', 'success'); return true; } catch (err) { /* Error shown by API */ return false; } finally { setLoading(false); } }, [api, showToast, setLoading]);
    const handleDeleteAccount = useCallback(() => { if (!currentUser || currentUser.id === OWNER_ID) return; openConfirmModal( "Xác nhận xóa", "CẢNH BÁO! Hành động này không thể hoàn tác...", async () => { setLoading(true); try { await api.delete('/users/me'); handleLogout(); /* No closeConfirmModal needed after logout */ } catch (err) { closeConfirmModal(); setLoading(false); } }); }, [api, currentUser, handleLogout, openConfirmModal, closeConfirmModal, setLoading]);
     const handleAvatarUpdate = useCallback(async () => { if (!completedCrop || !imgRef.current || !currentUser) return; setLoading(true); try { const croppedImageFile = await getCroppedImg(imgRef.current, completedCrop, originalFileName, 128); if (croppedImageFile) { const reader = new FileReader(); reader.readAsDataURL(croppedImageFile); reader.onloadend = async () => { const base64data = reader.result; try { const data = await api.put('/users/me/avatar', { avatarDataUrl: base64data }); const updatedUser = data.user; setCurrentUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser); setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u)); setIsAvatarModalOpen(false); setImgSrc(''); showToast('Cập nhật ảnh đại diện thành công!', 'success'); } catch (err) {} finally { setLoading(false); } }; reader.onerror = () => { throw new Error("Không thể đọc file ảnh."); }; } else { throw new Error("Could not crop image."); } } catch (err) { showToast('Lỗi cập nhật ảnh đại diện.', 'error'); setLoading(false); } }, [api, completedCrop, originalFileName, currentUser, showToast, setLoading, setCurrentUser, setUsers, setIsAvatarModalOpen, setImgSrc]);

    // --- Admin Handlers ---
    const handleAdminUpdateUserRole = useCallback(async (id: number, role: Role) => { if (id === OWNER_ID) { showToast("Không thể thay đổi vai trò Owner.", "error"); return; } setLoading(true); try { const data = await api.put(`/admin/users/${id}/role`, { role }); const updatedUser = data.user; setUsers(prev => prev.map(u => u.id === id ? updatedUser : u)); showToast(`Đã cập nhật vai trò ID ${id}.`, "success"); } catch (e) {} finally { setLoading(false); } }, [api, setUsers, showToast, setLoading]);
    const handleAdminToggleBanUser = useCallback(async (id: number) => { if (id === OWNER_ID) { showToast("Không thể khóa/mở khóa Owner.", "error"); return; } setLoading(true); try { const data = await api.put(`/admin/users/${id}/ban`, {}); const updatedUser = data.user; setUsers(prev => prev.map(u => u.id === id ? updatedUser : u)); showToast(`Đã ${updatedUser.isBanned ? 'khóa' : 'mở khóa'} ID ${id}.`, "success"); } catch (e) {} finally { setLoading(false); } }, [api, setUsers, showToast, setLoading]);
    const handleAdminDeleteUser = useCallback((id: number) => { if (id === OWNER_ID) { showToast("Không thể xóa Owner.", "error"); return; } openConfirmModal("Xác nhận xóa", `Xóa người dùng ID ${id}? Hành động này không thể hoàn tác.`, async () => { setLoading(true); try { await api.delete(`/admin/users/${id}`); await fetchAllData(); showToast(`Đã xóa ID ${id}.`, "success"); closeConfirmModal(); } catch (e) { closeConfirmModal(); } finally { setLoading(false); } }); }, [api, fetchAllData, openConfirmModal, closeConfirmModal, showToast, setLoading]);
    const handleAdminAddTag = useCallback(async (name: string) => { setLoading(true); try { const data = await api.post('/admin/tags', { name }); setAllTags(prev => [...prev, data.tag].sort((a,b)=> a.name.localeCompare(b.name))); showToast(`Đã thêm tag "${name}".`, "success"); } catch (e) {} finally { setLoading(false); } }, [api, showToast, setLoading, setAllTags]);
    const handleAdminDeleteTag = useCallback(async (id: number) => { setLoading(true); try { await api.delete(`/admin/tags/${id}`); setAllTags(prev => prev.filter(t => t.id !== id)); showToast(`Đã xóa tag ID ${id}.`, "success"); if (editingProblem !== 'new' && editingProblem?.tags.includes(id)) { setEditingProblem(prev => prev === 'new' ? 'new' : prev ? { ...prev, tags: prev.tags.filter(tId => tId !== id) } : null); } } catch (e) {} finally { setLoading(false); } }, [api, editingProblem, showToast, setLoading, setAllTags, setEditingProblem]);
    const handleAdminAddMetric = useCallback(async (key: string, direction: Direction) => { setLoading(true); try { const data = await api.post('/admin/metrics', { key, direction }); setAllMetrics(prev => [...prev, data.metric].sort((a,b)=> a.key.localeCompare(b.key))); showToast(`Đã thêm metric "${key}".`, "success"); } catch (e) {} finally { setLoading(false); } }, [api, showToast, setLoading, setAllMetrics]);
    const handleAdminDeleteMetric = useCallback(async (id: number) => { setLoading(true); try { await api.delete(`/admin/metrics/${id}`); setAllMetrics(prev => prev.filter(m => m.id !== id)); showToast(`Đã xóa metric ID ${id}.`, "success"); if (editingProblem !== 'new' && editingProblem?.metrics.includes(id)) { setEditingProblem(prev => prev === 'new' ? 'new' : prev ? { ...prev, metrics: prev.metrics.filter(mId => mId !== id) } : null); } } catch (e) {} finally { setLoading(false); } }, [api, editingProblem, showToast, setLoading, setAllMetrics, setEditingProblem]);

    // --- Discussion Handlers ---
    const handlePostSubmit = useCallback(async (title: string, content: string) => { if (!selectedProblem) { showToast("Lỗi: Không có bài toán được chọn.", "error"); return; } if (!currentUser) { showToast("Bạn cần đăng nhập.", "error"); return; } setLoading(true); try { const data = await api.post('/discussion/posts', { title, content, problemId: selectedProblem.id }); // Use correct endpoint
         // Optimistic update or refetch
         // setPosts(prev => [...prev, data.post]); // Basic optimistic add
         await fetchAllData(); // Refetch for consistency
         setShowNewPostModal(false);
         // setViewingPost(posts.find(p => p.id === data.post.id) || data.post); // This might fetch the old posts state
         setViewingPost(data.post); // Assume API returns the full post object needed
         showToast("Đăng bài thành công!", "success"); } catch (err) {} finally { setLoading(false); } }, [api, selectedProblem, currentUser, showToast, setLoading, fetchAllData, setShowNewPostModal, setViewingPost /* remove posts dependency */]);
    const handleCommentSubmit = useCallback(async (postId: number, content: string, parentId: number | null) => { if (!currentUser) { showToast("Bạn cần đăng nhập.", "error"); return; } try { const data = await api.post('/discussion/comments', { content, postId, parentId }); // Use correct endpoint
         // Optimistic update or refetch
         // setComments(prev => [...prev, data.comment]); // Basic optimistic add
         setReplyingTo(null);
         await fetchAllData(); // Refetch for consistency
         showToast("Bình luận thành công!", "success");
         } catch (err) {} }, [api, currentUser, showToast, setReplyingTo, fetchAllData]);
    const handleVote = useCallback(async (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => { if (!currentUser) { showToast("Bạn cần đăng nhập.", "error"); return; } const userId = currentUser.id; const optimisticUpdate = (items: any[], id: number) => items.map(item => { if (item.id !== id) return item; const upvotes = item.upvotedBy || []; const downvotes = item.downvotedBy || []; const wasUpvoted = upvotes.includes(userId); const wasDownvoted = downvotes.includes(userId); let newUpvotes = upvotes.filter((uid: number) => uid !== userId); let newDownvotes = downvotes.filter((uid: number) => uid !== userId); if (voteType === 'up' && !wasUpvoted) newUpvotes.push(userId); if (voteType === 'down' && !wasDownvoted) newDownvotes.push(userId); return { ...item, upvotedBy: newUpvotes, downvotedBy: newDownvotes }; }); if (targetType === 'posts') { setPosts(prev => optimisticUpdate(prev, targetId)); if (viewingPost?.id === targetId) setViewingPost(prev => prev ? optimisticUpdate([prev], targetId)[0] : null); } else setComments(prev => optimisticUpdate(prev, targetId)); try { await api.post(`/discussion/${targetType}/${targetId}/vote`, { voteType }); // Use correct endpoint
         // Refetch after successful API call to ensure data consistency
         await fetchAllData(); } catch (err) { showToast("Bỏ phiếu thất bại. Đang khôi phục...", "error"); fetchAllData(); } }, [api, currentUser, viewingPost, fetchAllData, showToast, setPosts, setViewingPost, setComments]);
    // --- NEW Discussion Edit/Delete Handlers ---
     const handleUpdatePost = useCallback(async (postId: number, title: string, content: string) => { setLoading(true); try { const data = await api.put(`/discussion/posts/${postId}`, { title, content }); setPosts(prev => prev.map(p => p.id === postId ? data.post : p)); if (viewingPost?.id === postId) setViewingPost(data.post); setEditingItemId(null); setEditingItemType(null); showToast("Cập nhật bài viết thành công.", "success"); } catch (e) {} finally { setLoading(false); } }, [api, setLoading, setPosts, viewingPost, setViewingPost, setEditingItemId, setEditingItemType, showToast]);
     const handleDeletePost = useCallback((postId: number) => { openConfirmModal("Xóa bài viết?", "Hành động này sẽ xóa bài viết và tất cả bình luận liên quan.", async () => { setLoading(true); try { await api.delete(`/discussion/posts/${postId}`); setPosts(prev => prev.filter(p => p.id !== postId)); setComments(prev => prev.filter(c => c.postId !== postId)); // Optimistically remove comments too
         if (viewingPost?.id === postId) setViewingPost(null); // Go back to list if viewing deleted post
         closeConfirmModal(); showToast("Xóa bài viết thành công.", "success"); } catch (e) { closeConfirmModal(); } finally { setLoading(false); } }); }, [api, setLoading, setPosts, setComments, viewingPost, setViewingPost, openConfirmModal, closeConfirmModal, showToast]);
     const handleUpdateComment = useCallback(async (commentId: number, content: string) => { setLoading(true); try { const data = await api.put(`/discussion/comments/${commentId}`, { content }); setComments(prev => prev.map(c => c.id === commentId ? data.comment : c)); setEditingItemId(null); setEditingItemType(null); showToast("Cập nhật bình luận thành công.", "success"); } catch (e) {} finally { setLoading(false); } }, [api, setLoading, setComments, setEditingItemId, setEditingItemType, showToast]);
     const handleDeleteComment = useCallback((commentId: number) => { openConfirmModal("Xóa bình luận?", "Hành động này không thể hoàn tác.", async () => { setLoading(true); try { await api.delete(`/discussion/comments/${commentId}`); // Find replies to optimistically remove
         const getRepliesRecursive = (id: number, all: DiscussionComment[]): number[] => { const direct = all.filter(c => c.parentId === id).map(c => c.id); return [...direct, ...direct.flatMap(childId => getRepliesRecursive(childId, all))]; }; const repliesToDelete = getRepliesRecursive(commentId, comments); setComments(prev => prev.filter(c => c.id !== commentId && !repliesToDelete.includes(c.id))); closeConfirmModal(); showToast("Xóa bình luận thành công.", "success"); } catch (e) { closeConfirmModal(); } finally { setLoading(false); } }); }, [api, setLoading, comments, setComments, openConfirmModal, closeConfirmModal, showToast]);


    // --- Hint Handler ---
    const handleGetHint = useCallback(async () => { if (!selectedProblem) return; const prompt = `Give a concise hint (max 2-3 sentences, focus on approach, not code) for the machine learning problem: ${selectedProblem.name}. Problem description summary: ${selectedProblem.content.replace(/<[^>]*>/g, '').substring(0, 300)}...`; setIsGeneratingHint(true); setProblemHint(null); setError(''); try { const apiKey = ""; const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`; const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 100 } }; const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData?.error?.message || `API call failed: ${response.status}`); } const result = await response.json(); const text = result.candidates?.[0]?.content?.parts?.[0]?.text; if (!text) throw new Error("Không nhận được gợi ý."); setProblemHint(text.trim()); } catch (e: any) { showToast(`Lỗi gợi ý: ${e.message}`, 'error'); console.error("Hint Error:", e); } finally { setIsGeneratingHint(false); } }, [selectedProblem, showToast, setIsGeneratingHint, setProblemHint, setError]);

    // --- Dataset Download ---
    const downloadDataset = useCallback((content: string, filename: string) => { if (!content) { showToast("Nội dung dataset trống.", "error"); return; } try { const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.setAttribute('download', filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } catch (e) { console.error("Download error:", e); showToast("Lỗi tải dataset.", "error"); } }, [showToast]);

     // --- Navigation ---
     const navigateToProfile = useCallback((userIdOrUsername: number | string) => { let userToView: User | undefined; if (typeof userIdOrUsername === 'number') userToView = users.find(u => u.id === userIdOrUsername); else userToView = users.find(u => u.username.toLowerCase() === userIdOrUsername.toLowerCase()); if (userToView) { setViewingUserId(userToView.id); setPage('profile'); } else { showToast(`Không tìm thấy người dùng "${userIdOrUsername}".`, 'error'); } }, [users, setPage, setViewingUserId, showToast]);

      // --- Problem Submission Handler ---
     const handleProblemSubmit = useCallback(async (formData: FormData) => {
        setLoading(true);
        try {
            await api.post("/submissions", formData);
            await fetchAllData(); // Fetch all data to update submissions and leaderboard
             showToast("Nộp bài thành công!", "success");
             setRightPanelTab("leaderboard"); // Switch tab after successful submission
         } catch (submitError: any) { console.error("Submission failed:", submitError); /* Error shown by API helper */ }
         finally { setLoading(false); }
     }, [api, setLoading, fetchAllData, showToast, setRightPanelTab]);


    // --- CONTEXT VALUE ---
    const contextValue = useMemo(() => ({
        currentUser, setCurrentUser, users, setUsers, problems, setProblems, allTags, setAllTags, allMetrics, setAllMetrics,
        submissions, setSubmissions, posts, setPosts, comments, setComments, leaderboardData, setLeaderboardData, page, setPage,
        editingProblem, setEditingProblem, currentView, setCurrentView, authMode, setAuthMode, selectedProblem, setSelectedProblem,
        viewingUserId, setViewingUserId, loading, setLoading, error, setError, confirmModal, setConfirmModal,
        imgSrc, setImgSrc, crop, setCrop, completedCrop, setCompletedCrop, isAvatarModalOpen, setIsAvatarModalOpen, originalFileName, setOriginalFileName, imgRef,
        problemHint, setProblemHint, isGeneratingHint, setIsGeneratingHint, leftPanelTab, setLeftPanelTab, rightPanelTab, setRightPanelTab,
        viewingPost, setViewingPost, showNewPostModal, setShowNewPostModal, replyingTo, setReplyingTo, adminSubPage, setAdminSubPage,
        toastMessage, toastType, editingItemId, setEditingItemId, editingItemType, setEditingItemType, // Added editing state
        api, fetchAllData, handleSignup, handleLogin, handleLogout, handleSaveProblem, handleDeleteProblem, handleSettingsUpdate, handleChangePassword, handleDeleteAccount,
        handleAdminUpdateUserRole, handleAdminToggleBanUser, handleAdminDeleteUser, handleAdminAddTag, handleAdminDeleteTag, handleAdminAddMetric, handleAdminDeleteMetric,
        handlePostSubmit, handleCommentSubmit, handleVote, handleGetHint, downloadDataset, openConfirmModal, closeConfirmModal, navigateToProfile,
        showToast, clearToast, handleProblemSubmit, handleAvatarUpdate,
        handleUpdatePost, handleDeletePost, handleUpdateComment, handleDeleteComment // Added new discussion handlers
    }), [ // Ensure all state and callbacks are listed
        currentUser, users, problems, allTags, allMetrics, submissions, posts, comments, leaderboardData, page, editingProblem, currentView, authMode,
        selectedProblem, viewingUserId, loading, error, confirmModal, imgSrc, crop, completedCrop, isAvatarModalOpen, originalFileName, /* imgRef omitted */
        problemHint, isGeneratingHint, leftPanelTab, rightPanelTab, viewingPost, showNewPostModal, replyingTo, adminSubPage,
        toastMessage, toastType, editingItemId, editingItemType, // Added editing state
        api, fetchAllData, handleSignup, handleLogin, handleLogout, handleSaveProblem, handleDeleteProblem, handleSettingsUpdate, handleChangePassword, handleDeleteAccount,
        handleAdminUpdateUserRole, handleAdminToggleBanUser, handleAdminDeleteUser, handleAdminAddTag, handleAdminDeleteTag, handleAdminAddMetric, handleAdminDeleteMetric,
        handlePostSubmit, handleCommentSubmit, handleVote, handleGetHint, downloadDataset, openConfirmModal, closeConfirmModal, navigateToProfile,
        showToast, clearToast, handleProblemSubmit, handleAvatarUpdate,
        handleUpdatePost, handleDeletePost, handleUpdateComment, handleDeleteComment // Added new discussion handlers
    ]);


    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};
