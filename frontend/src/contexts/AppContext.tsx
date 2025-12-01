import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import type {
    User, Problem, Tag, Metric, Submission, DiscussionPost, DiscussionComment,
    Page, AuthMode, CurrentView, ConfirmModalState, LeaderboardEntry, Dataset, Role, Direction, UserProfile, NotificationPreferences, Education, WorkExperience
} from '../types';
import { API_BASE_URL, OWNER_ID } from '../api';
import { getCroppedImg } from '../utils';
import { format, parseISO, startOfDay, formatDistanceToNow, isValid } from 'date-fns';

const derivePageFromPath = (pathname: string): Page => {
    if (matchPath('/problem-editor', pathname)) return 'problem-editor';
    if (matchPath('/my-submissions', pathname)) return 'my-submissions';
    if (matchPath('/profile/:identifier', pathname) || pathname === '/profile') return 'profile';
    if (matchPath('/admin', pathname)) return 'admin';
    if (matchPath('/settings', pathname)) return 'settings';
    if (matchPath('/problems/:problemId', pathname)) return 'problem-detail';
    return 'problems';
};

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
    imgSrc: string; // For avatar crop
    isAvatarModalOpen: boolean;
    originalFileName: string; // For avatar crop filename
    problemHint: string | null;
    isGeneratingHint: boolean;
    leftPanelTab: 'description' | 'discussion' | 'datasets';
    rightPanelTab: 'leaderboard' | 'submissions';
    viewingPost: DiscussionPost | null;
    showNewPostModal: boolean;
    replyingTo: number | null; // ID of comment being replied to
    adminSubPage: 'users' | 'tags-metrics';
    toastMessage: string | null;
    toastType: 'success' | 'error' | 'info' | null;
    editingItemId: number | null; // ID of post/comment being edited
    editingItemType: 'post' | 'comment' | null; // Type of item being edited
    votingKey: string | null; // Current vote in-flight (prevents spam)


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
    setVotingKey: React.Dispatch<React.SetStateAction<string | null>>;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    clearToast: () => void;
    setEditingItemId: React.Dispatch<React.SetStateAction<number | null>>;
    setEditingItemType: React.Dispatch<React.SetStateAction<'post' | 'comment' | null>>;

    // API Helper
    api: { get: (endpoint: string) => Promise<any>; post: (endpoint: string, body?: any) => Promise<any>; put: (endpoint: string, body?: any) => Promise<any>; delete: (endpoint: string) => Promise<any>; };

     // Action Handlers
    fetchAllData: () => Promise<void>;
    handleSignup: (username: string, email: string, password: string) => Promise<void>;
    handleLogin: (credential: string, password: string) => Promise<void>;
    handleLogout: () => Promise<void>;
    handleSaveProblem: (
        problemData: Partial<Problem> & { evaluationScriptContent: string },
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null }
    ) => Promise<void>;
    handleDeleteProblem: (id: number) => void;
    handleSettingsUpdate: (updatedUserData: Pick<User, 'username' | 'email' | 'profile'>) => Promise<void>;
    handleChangePassword: (currentPass: string, newPass: string) => Promise<boolean>;
    handleDeleteAccount: () => void;
    handleAdminUpdateUserRole: (id: number, role: Role) => Promise<void>;
    handleAdminToggleBanUser: (id: number) => Promise<void>;
    handleAdminDeleteUser: (id: number, username: string) => void; // Added username for confirmation
    handleAdminAddTag: (name: string) => Promise<void>;
    handleAdminDeleteTag: (id: number, name: string) => void; // Added name for confirmation
    handleAdminAddMetric: (key: string, direction: Direction) => Promise<void>;
    handleAdminDeleteMetric: (id: number, key: string) => void; // Added key for confirmation
    handlePostSubmit: (title: string, content: string) => Promise<void>;
    handleCommentSubmit: (postId: number, content: string, parentId: number | null) => Promise<void>;
    handleVote: (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => Promise<void>;
    handleGetHint: () => Promise<void>;
    downloadDataset: (content: string | undefined, filename: string) => void;
    openConfirmModal: (title: string, message: string, onConfirm: () => void) => void;
    closeConfirmModal: () => void;
    navigateToProfile: (userIdOrUsername: number | string) => void;
    handleProblemSubmit: (formData: FormData) => Promise<void>;
    handleAvatarUpdate: (croppedImageBlob: Blob | null, fileName: string) => Promise<void>;
    handleUpdatePost: (postId: number, title: string, content: string) => Promise<void>;
    handleDeletePost: (postId: number) => void;
    handleUpdateComment: (commentId: number, content: string) => Promise<void>;
    handleDeleteComment: (commentId: number) => void;
    navigate: (targetPage: Page, targetId?: number | string | null, replace?: boolean) => void;
}

// Create the context
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Define the provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const routerNavigate = useNavigate();

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
    const [page, setPage] = useState<Page>(() => derivePageFromPath(location.pathname));
    const [editingProblem, setEditingProblem] = useState<Problem | "new" | null>(null);
    const [currentView, setCurrentView] = useState<CurrentView>("loading");
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
    const [viewingUserId, setViewingUserId] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
    const [imgSrc, setImgSrc] = useState('');
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [originalFileName, setOriginalFileName] = useState('avatar.png');
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
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editingItemType, setEditingItemType] = useState<'post' | 'comment' | null>(null);
    const [votingKey, setVotingKey] = useState<string | null>(null);


     // --- Toast Functions ---
     const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => { setToastMessage(message); setToastType(type); setError(''); }, []);
     const clearToast = useCallback(() => { setToastMessage(null); setToastType(null); }, []);

    // --- Sync route -> state ---
    useEffect(() => {
        const pathname = location.pathname;
        const nextPage = derivePageFromPath(pathname);
        if (page !== nextPage) {
            setPage(nextPage);
        }

        const problemMatch = matchPath('/problems/:problemId', pathname);
        if (problemMatch && problemMatch.params?.problemId) {
            const problemId = Number(problemMatch.params.problemId);
            if (!Number.isNaN(problemId)) {
                const foundProblem = problems.find(p => p.id === problemId);
                if (foundProblem) {
                    if (!selectedProblem || selectedProblem.id !== foundProblem.id) {
                        setSelectedProblem(foundProblem);
                    }
                } else if (!loading && problems.length > 0) {
                    showToast(`Không tìm thấy bài toán ID ${problemId}.`, 'error');
                    routerNavigate('/problems', { replace: true });
                }
            }
        } else if (selectedProblem) {
            setSelectedProblem(null);
            setViewingPost(null);
            setLeftPanelTab('description');
            setRightPanelTab('leaderboard');
        }

        const profileMatch = matchPath('/profile/:identifier', pathname);
        if (profileMatch && profileMatch.params?.identifier) {
            const identifier = profileMatch.params.identifier;
            let matchedUser: User | undefined;
            const numericId = Number(identifier);
            if (!Number.isNaN(numericId)) {
                matchedUser = users.find(u => u.id === numericId);
            } else {
                matchedUser = users.find(u => u.username.toLowerCase() === identifier.toLowerCase());
            }
            if (matchedUser) {
                if (viewingUserId !== matchedUser.id) {
                    setViewingUserId(matchedUser.id);
                }
            } else if (!loading && users.length > 0) {
                showToast(`Không tìm thấy người dùng \"${identifier}\".`, 'error');
                routerNavigate('/problems', { replace: true });
            }
        } else if (matchPath('/profile', pathname)) {
            if (currentUser && viewingUserId !== currentUser.id) {
                setViewingUserId(currentUser.id);
            }
        } else if (viewingUserId !== null) {
            setViewingUserId(null);
        }
    }, [location.pathname, page, problems, selectedProblem, loading, routerNavigate, showToast, users, viewingUserId, currentUser]);

    const navigate = useCallback((targetPage: Page, targetId: number | string | null = null, replace: boolean = false) => {
        let resolvedPage: Page = targetPage;
        let path = '/problems';

        const resetNonDetailState = () => {
            setViewingPost(null);
            setLeftPanelTab('description');
            setRightPanelTab('leaderboard');
        };

        const fallbackToProblems = () => {
            resolvedPage = 'problems';
            path = '/problems';
        };

        switch (targetPage) {
            case 'problem-detail': {
                if (typeof targetId !== 'number') {
                    showToast('ID bài toán không hợp lệ.', 'error');
                    fallbackToProblems();
                    break;
                }
                const problem = problems.find(p => p.id === targetId);
                if (!problem) {
                    showToast(`Không tìm thấy bài toán ID ${targetId}.`, 'error');
                    fallbackToProblems();
                    break;
                }
                setSelectedProblem(problem);
                resetNonDetailState();
                path = `/problems/${targetId}`;
                break;
            }
            case 'profile': {
                let user: User | undefined;
                if (typeof targetId === 'number') {
                    user = users.find(u => u.id === targetId);
                } else if (typeof targetId === 'string' && targetId.trim()) {
                    user = users.find(u => u.username.toLowerCase() === targetId.toLowerCase());
                } else if (currentUser) {
                    user = currentUser;
                }
                if (!user) {
                    showToast('Không tìm thấy người dùng.', 'error');
                    fallbackToProblems();
                    break;
                }
                setViewingUserId(user.id);
                path = `/profile/${user.username}`;
                break;
            }
            case 'problem-editor':
                path = '/problem-editor';
                break;
            case 'my-submissions':
                path = '/my-submissions';
                break;
            case 'admin':
                path = '/admin';
                break;
            case 'settings':
                path = '/settings';
                break;
            case 'problems':
            default:
                fallbackToProblems();
                break;
        }

        if (resolvedPage !== 'problem-detail') {
            setSelectedProblem(null);
            resetNonDetailState();
        }
        if (resolvedPage !== 'profile') {
            setViewingUserId(null);
        }
        if (resolvedPage !== 'problem-editor') {
            setEditingProblem(null);
        }

        setPage(resolvedPage);
        routerNavigate(path, { replace });
    }, [problems, users, currentUser, showToast, routerNavigate]);

    // --- API HELPER ---
    const api = useMemo(() => {
        const request = async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) => {
            const url = `${API_BASE_URL}${endpoint}`;
            const options: RequestInit = { method, headers: {}, credentials: 'include' };
            if (body) { if (body instanceof FormData) { options.body = body; } else { (options.headers as Record<string, string>)['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); } }
            try { console.log(`API Request: ${method} ${url}`, body instanceof FormData ? '[FormData]' : body); const response = await fetch(url, options); console.log(`API Response Status: ${response.status} for ${method} ${url}`); if (response.status === 204) return null; let data; const contentType = response.headers.get("content-type"); if (contentType && contentType.indexOf("application/json") !== -1) { data = await response.json(); console.log(`API Response Data (JSON):`, data); } else { const textData = await response.text(); console.log(`API Response Data (Text):`, textData); if (!response.ok) throw new Error(textData || `API Error: ${response.status} ${response.statusText}`); return { message: textData }; } if (!response.ok) { throw new Error(data.message || `API Error: ${response.status} ${response.statusText}`); } return data;
            } catch (err: any) { console.error(`API Error on ${method} ${url}:`, err); let errorMessage = 'Có lỗi không mong muốn xảy ra.'; if (err.message) { errorMessage = err.message; } if (toastMessage !== errorMessage) { showToast(errorMessage, 'error'); } throw err; }
        };
        return { get: (ep: string) => request(ep, 'GET'), post: (ep: string, b?: any) => request(ep, 'POST', b), put: (ep: string, b?: any) => request(ep, 'PUT', b), delete: (ep: string) => request(ep, 'DELETE'), };
    }, [showToast, toastMessage]);

    // --- ASYNC ACTION HANDLERS ---
     const fetchAllData = useCallback(async () => {
        try { const data = await api.get('/initial-data'); setUsers(data.users || []); setProblems(data.problems || []); setAllTags(data.tags || []); setAllMetrics(data.metrics || []); setSubmissions(data.submissions || []); setPosts(data.posts || []); setComments(data.comments || []); console.log("Fetched initial data:", data);
        } catch (e) { console.error("Failed to fetch initial data:", e); setUsers([]); setProblems([]); setAllTags([]); setAllMetrics([]); setSubmissions([]); setPosts([]); setComments([]); setLeaderboardData({}); }
    }, [api]);


    // --- Leaderboard Calculation Effect ---
     useEffect(() => {
        if (loading || !problems.length || !allMetrics.length) { return; }
       const newLeaderboardData: { [key: number]: LeaderboardEntry[] } = {};
       try {
            problems.forEach((problem) => {
                if (problem?.id === undefined || problem?.id === null) return;
                const problemSubmissions = submissions.filter(s => s.problemId === problem.id && s.status === 'succeeded' && typeof s.publicScore === 'number' && s.submittedAt);
                if (problemSubmissions.length === 0) {
                    newLeaderboardData[problem.id] = [];
                    return;
                }
                const primaryMetricLink = problem.metricsLinks?.find(link => link.isPrimary);
                const fallbackMetricId = Array.isArray(problem.metrics) && problem.metrics.length > 0 ? problem.metrics[0] : undefined;
                const primaryMetricId = primaryMetricLink?.metricId ?? fallbackMetricId;
                const metric = primaryMetricId !== undefined ? allMetrics.find(m => m.id === primaryMetricId) : undefined;
                const metricDirection: Direction = metric?.direction || 'maximize';

                const bestScores = new Map<number, Submission>();
                problemSubmissions.forEach((sub) => {
                    try {
                        if (!sub.submittedAt || !isValid(parseISO(sub.submittedAt))) return;
                    } catch {
                        return;
                    }
                    const existingBest = bestScores.get(sub.userId);
                    if (!existingBest || typeof existingBest.publicScore !== 'number' || !existingBest.submittedAt || !isValid(parseISO(existingBest.submittedAt))) {
                        bestScores.set(sub.userId, sub);
                        return;
                    }
                    const isNewScoreBetter = metricDirection === 'maximize'
                        ? sub.publicScore! > existingBest.publicScore
                        : sub.publicScore! < existingBest.publicScore;
                    const areScoresEqual = sub.publicScore === existingBest.publicScore;
                    const isEarlierSubmission = new Date(sub.submittedAt!).getTime() < new Date(existingBest.submittedAt).getTime();
                    if (isNewScoreBetter || (areScoresEqual && isEarlierSubmission)) {
                        bestScores.set(sub.userId, sub);
                    }
                });

                const sortedEntries: LeaderboardEntry[] = Array.from(bestScores.values())
                    .map(sub => ({ rank: 0, username: sub.username, score: sub.publicScore!, subId: sub.id, time: sub.submittedAt! }))
                    .sort((a, b) => {
                        const scoreDiff = metricDirection === 'maximize' ? b.score - a.score : a.score - b.score;
                        if (scoreDiff !== 0) return scoreDiff;
                        return new Date(a.time).getTime() - new Date(b.time).getTime();
                    });
                sortedEntries.forEach((entry, index) => { entry.rank = index + 1; });
                newLeaderboardData[problem.id] = sortedEntries;
            });
            setLeaderboardData(newLeaderboardData);
       } catch (error) { console.error("Error calculating leaderboard:", error); showToast("Lỗi khi tính toán bảng xếp hạng.", "error"); setLeaderboardData({}); }
    }, [submissions, problems, allMetrics, loading, showToast]);

    // --- Auth Handlers ---
     const handleSignup = useCallback(async (username: string, email: string, password: string) => { setLoading(true); try { const data = await api.post('/auth/signup', { username, email, password }); setCurrentUser(data.user); await fetchAllData(); setCurrentView('main'); navigate('problems', null, true); showToast(`Chào mừng ${data.user.username}!`, 'success'); } catch (err) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, fetchAllData, showToast, setLoading, setCurrentUser, setCurrentView, navigate]);
     const handleLogin = useCallback(async (credential: string, password: string) => { setLoading(true); try { const data = await api.post('/auth/login', { credential, password }); setCurrentUser(data.user); await fetchAllData(); setCurrentView('main'); navigate('problems', null, true); showToast(`Chào mừng trở lại, ${data.user.username}!`, 'success'); } catch (err) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, fetchAllData, showToast, setLoading, setCurrentUser, setCurrentView, navigate]);
     const handleLogout = useCallback(async () => { setLoading(true); try { await api.post('/auth/logout', {}); setCurrentUser(null); setUsers([]); setProblems([]); setSubmissions([]); setPosts([]); setComments([]); setLeaderboardData({}); setSelectedProblem(null); setViewingUserId(null); setCurrentView('auth'); setError(''); showToast("Đã đăng xuất.", 'info'); routerNavigate('/problems', { replace: true }); } catch (err) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, showToast, setLoading, setCurrentUser, setUsers, setProblems, setSubmissions, setPosts, setComments, setLeaderboardData, setSelectedProblem, setViewingUserId, setCurrentView, setError, routerNavigate]);

     // --- Initial Session Check & Data Load ---
    useEffect(() => {
        const initializeApp = async () => {
            console.log("Initializing App...");
            setLoading(true);
            try {
                console.log("Checking session...");
                const data = await api.get('/auth/check-session');
                console.log("Session check successful, user:", data.user?.username);
                setCurrentUser(data.user);
            } catch (e) {
                console.log("No active session or error checking session. Continuing as guest.");
                setCurrentUser(null);
            }
            try {
                console.log("Fetching all data...");
                await fetchAllData();
                console.log("Data fetch complete.");
            } catch (err) {
                console.error("Failed to fetch initial data:", err);
            }
            setCurrentView('main');
            console.log("Initialization complete. Setting loading to false.");
            setLoading(false);
        };
        initializeApp();
    }, [api, fetchAllData]);

    // --- Navigation Function ---

    // --- Problem Handlers ---
    const handleSaveProblem = useCallback(async ( problemData: Partial<Problem> & { evaluationScriptContent: string }, tagIds: number[], metricIds: number[], files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null } ) => { if (!currentUser) { showToast("Bạn cần đăng nhập để lưu bài toán.", "error"); return; } setLoading(true); setError(''); try { console.log("Preparing FormData for problem save..."); const formData = new FormData(); const dataToSend = { ...problemData, tagIds, metricIds, existingDatasets: (editingProblem !== 'new' && editingProblem?.datasets) ? editingProblem.datasets : [], }; formData.append('problemData', JSON.stringify(dataToSend)); console.log("Appended problemData:", dataToSend); if (files.trainFile) { formData.append('trainCsv', files.trainFile); console.log(`Appending trainCsv: ${files.trainFile.name}`); } if (files.testFile) { formData.append('testCsv', files.testFile); console.log(`Appending testCsv: ${files.testFile.name}`); } if (files.groundTruthFile) { formData.append('groundTruthCsv', files.groundTruthFile); console.log(`Appending groundTruthCsv: ${files.groundTruthFile.name}`); } let savedProblemData; if (editingProblem === 'new') { console.log("Calling API: POST /problems"); if (!files.trainFile || !files.testFile || !files.groundTruthFile) { throw new Error("Vui lòng tải lên đủ file train, test (public), và ground truth cho bài toán mới."); } savedProblemData = await api.post('/problems', formData); showToast("Tạo bài toán thành công!", "success"); } else if (editingProblem) { console.log(`Calling API: PUT /problems/${editingProblem.id}`); if (currentUser.role !== 'owner' && editingProblem.authorId !== currentUser.id) { throw new Error("Không được phép chỉnh sửa bài toán này."); } const needsGT = !files.groundTruthFile && !editingProblem.hasGroundTruth; if(needsGT) { console.warn("Update needs ground truth, but no file provided and none exists."); } savedProblemData = await api.put(`/problems/${editingProblem.id}`, formData); showToast("Cập nhật bài toán thành công!", "success"); } else { throw new Error("Trạng thái chỉnh sửa không hợp lệ."); } console.log("Problem save successful, fetching all data..."); await fetchAllData(); const newProblemId = savedProblemData?.problem?.id; console.log("Data refetched. Navigating..."); if (newProblemId !== undefined) { navigate('problem-detail', newProblemId); } else { console.warn("Saved problem data missing ID, navigating to list."); navigate('problems'); } setEditingProblem(null); } catch (e: any) { console.error("Save Problem Error:", e); } finally { setLoading(false); } }, [api, currentUser, editingProblem, fetchAllData, showToast, setLoading, setEditingProblem, navigate, setError]);

    const openConfirmModal = useCallback((title: string, message: string, onConfirm: () => void) => { setConfirmModal({ isOpen: true, title, message, onConfirm }); }, [setConfirmModal]);
    const closeConfirmModal = useCallback(() => setConfirmModal(null), [setConfirmModal]);
    // *** MODIFIED handleDeleteProblem: Removed finally, moved setLoading(false) ***
    const handleDeleteProblem = useCallback((id: number) => {
        openConfirmModal("Xác nhận xóa", "Bạn chắc chắn muốn xóa bài toán này và mọi dữ liệu liên quan (bài nộp, thảo luận)? Hành động này không thể hoàn tác.", async () => {
            setLoading(true);
            try {
                await api.delete(`/problems/${id}`);
                await fetchAllData();
                if (selectedProblem?.id === id) setSelectedProblem(null);
                showToast("Xóa bài toán thành công!", "success");
                closeConfirmModal();
                navigate('problems');
                setLoading(false); // Moved here
            } catch (e) {
                /* API helper shows toast */
                closeConfirmModal();
                setLoading(false); // Moved here
            }
            // NO finally block
        });
    }, [api, fetchAllData, openConfirmModal, closeConfirmModal, selectedProblem, showToast, setLoading, setSelectedProblem, navigate]);


    // --- Settings Handlers ---
    const handleSettingsUpdate = useCallback(async (updatedUserData: Pick<User, 'username' | 'email' | 'profile'>) => { if (!currentUser) return; setLoading(true); try { const data = await api.put('/users/me', updatedUserData); const updatedUser = data.user; setCurrentUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser); setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u)); showToast("Cập nhật thành công!", "success"); } catch (err) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, currentUser, showToast, setLoading, setCurrentUser, setUsers]);
    const handleChangePassword = useCallback(async (currentPass: string, newPass: string): Promise<boolean> => { setLoading(true); try { await api.post('/auth/change-password', { currentPassword: currentPass, newPassword: newPass }); showToast('Đổi mật khẩu thành công!', 'success'); setLoading(false); return true; } catch (err) { /* API helper shows toast */ setLoading(false); return false; } }, [api, showToast, setLoading]);
    // *** MODIFIED handleDeleteAccount: Removed finally, moved setLoading(false) ***
    const handleDeleteAccount = useCallback(() => {
        if (!currentUser || currentUser.id === OWNER_ID) return;
        openConfirmModal( "Xác nhận xóa tài khoản", "CẢNH BÁO! Hành động này sẽ xóa vĩnh viễn tài khoản và mọi dữ liệu liên quan (bài nộp, bình luận, etc.). Không thể hoàn tác.", async () => {
            setLoading(true);
            try {
                await api.delete('/users/me');
                // setLoading(false); // Move it before logout potentially
                handleLogout(); // Logout redirects, no need for setLoading false after this? Or maybe yes. Let's keep it simple.
                // If logout fails, the catch block below will handle setLoading.
                // Close modal might not be necessary if logout succeeds and view changes.
            } catch (err: any) {
                /* API helper shows toast */
                closeConfirmModal(); // Close modal on error
                setLoading(false);   // Set loading false on error
            }
            // NO finally block
        });
    }, [api, currentUser, handleLogout, openConfirmModal, closeConfirmModal, setLoading]);

    const handleAvatarUpdate = useCallback(async (croppedImageBlob: Blob | null, fileName: string) => { if (!croppedImageBlob || !currentUser) { if (!croppedImageBlob) showToast("Không thể cắt ảnh.", "error"); setIsAvatarModalOpen(false); setImgSrc(''); return; } const reader = new FileReader(); reader.readAsDataURL(croppedImageBlob); reader.onloadend = async () => { const base64data = reader.result; if (!base64data || typeof base64data !== 'string') { showToast("Không thể đọc ảnh.", "error"); setIsAvatarModalOpen(false); setImgSrc(''); return; } setLoading(true); try { const data = await api.put<{ user: User }>('/users/me/avatar', { avatarDataUrl: base64data }); if (data?.user) { setCurrentUser(prev => prev ? { ...prev, ...data.user } : data.user); setUsers(users.map(u => u.id === data.user.id ? data.user : u)); setIsAvatarModalOpen(false); setImgSrc(''); showToast("Cập nhật ảnh thành công!", "success"); } else { throw new Error("Dữ liệu người dùng trả về không hợp lệ."); } } catch (err: any) { /* Error handled by api helper */ } finally { setLoading(false); } }; reader.onerror = () => { showToast("Lỗi đọc file ảnh.", "error"); setIsAvatarModalOpen(false); setImgSrc(''); } }, [currentUser, api, setCurrentUser, setUsers, setIsAvatarModalOpen, setImgSrc, setLoading, showToast, users]);


    // --- Admin Handlers ---
    const handleAdminUpdateUserRole = useCallback(async (id: number, role: Role) => { if (id === OWNER_ID) { showToast("Không thể thay đổi vai trò Owner.", "error"); return; } setLoading(true); try { const data = await api.put(`/admin/users/${id}/role`, { role }); const updatedUser = data.user; setUsers(prev => prev.map(u => u.id === id ? updatedUser : u)); showToast(`Đã cập nhật vai trò cho "${updatedUser.username}".`, "success"); } catch (e) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, setUsers, showToast, setLoading]);
    const handleAdminToggleBanUser = useCallback(async (id: number) => { if (id === OWNER_ID) { showToast("Không thể khóa/mở khóa Owner.", "error"); return; } setLoading(true); try { const data = await api.put(`/admin/users/${id}/ban`, {}); const updatedUser = data.user; setUsers(prev => prev.map(u => u.id === id ? updatedUser : u)); showToast(`Đã ${updatedUser.isBanned ? 'khóa' : 'mở khóa'} tài khoản "${updatedUser.username}".`, "success"); } catch (e) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, setUsers, showToast, setLoading]);
    // *** MODIFIED handleAdminDeleteUser: Removed finally, moved setLoading(false) ***
    const handleAdminDeleteUser = useCallback((id: number, username: string) => {
        if (id === OWNER_ID) { showToast("Không thể xóa Owner.", "error"); return; }
        openConfirmModal("Xác nhận xóa người dùng", `Bạn chắc chắn muốn xóa "${username}" (ID: ${id})? Hành động này không thể hoàn tác.`, async () => {
            setLoading(true);
            try {
                await api.delete(`/admin/users/${id}`);
                await fetchAllData();
                showToast(`Đã xóa người dùng "${username}".`, "success");
                closeConfirmModal();
                setLoading(false); // Moved here
            } catch (e) {
                /* API helper shows toast */
                closeConfirmModal();
                setLoading(false); // Moved here
            }
             // NO finally block
        });
    }, [api, fetchAllData, openConfirmModal, closeConfirmModal, showToast, setLoading]);

    const handleAdminAddTag = useCallback(async (name: string) => { setLoading(true); try { const data = await api.post('/admin/tags', { name }); setAllTags(prev => [...prev, data.tag].sort((a,b)=> a.name.localeCompare(b.name))); showToast(`Đã thêm tag "${name}".`, "success"); } catch (e) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, showToast, setLoading, setAllTags]);
    // *** MODIFIED handleAdminDeleteTag: Removed finally, moved setLoading(false) ***
    const handleAdminDeleteTag = useCallback((id: number, name: string) => {
        openConfirmModal("Xác nhận xóa Tag", `Bạn chắc chắn muốn xóa tag "${name}"? Nếu tag này đang được sử dụng bởi bài toán nào đó, việc xóa có thể thất bại.`, async () => {
            setLoading(true);
            try {
                await api.delete(`/admin/tags/${id}`);
                setAllTags(prev => prev.filter(t => t.id !== id));
                showToast(`Đã xóa tag "${name}".`, "success");
                if (editingProblem !== 'new' && editingProblem?.tags.includes(id)) { setEditingProblem(prev => prev === 'new' ? 'new' : prev ? { ...prev, tags: prev.tags.filter(tId => tId !== id) } : null); }
                closeConfirmModal();
                setLoading(false); // Moved here
            } catch (e) {
                /* API helper shows toast */
                closeConfirmModal();
                setLoading(false); // Moved here
            }
            // NO finally block
        });
    }, [api, editingProblem, showToast, setLoading, setAllTags, setEditingProblem, openConfirmModal, closeConfirmModal]);

    const handleAdminAddMetric = useCallback(async (key: string, direction: Direction) => { setLoading(true); try { const data = await api.post('/admin/metrics', { key, direction }); setAllMetrics(prev => [...prev, data.metric].sort((a,b)=> a.key.localeCompare(b.key))); showToast(`Đã thêm metric "${key}".`, "success"); } catch (e) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, showToast, setLoading, setAllMetrics]);
    // *** MODIFIED handleAdminDeleteMetric: Removed finally, moved setLoading(false) ***
    const handleAdminDeleteMetric = useCallback((id: number, key: string) => {
        openConfirmModal("Xác nhận xóa Metric", `Bạn chắc chắn muốn xóa metric "${key}"? Nếu metric này đang được sử dụng, việc xóa có thể thất bại.`, async () => {
            setLoading(true);
            try {
                await api.delete(`/admin/metrics/${id}`);
                setAllMetrics(prev => prev.filter(m => m.id !== id));
                showToast(`Đã xóa metric "${key}".`, "success");
                if (editingProblem !== 'new' && editingProblem?.metrics.includes(id)) { setEditingProblem(prev => prev === 'new' ? 'new' : prev ? { ...prev, metrics: prev.metrics.filter(mId => mId !== id) } : null); }
                closeConfirmModal();
                setLoading(false); // Moved here
            } catch (e) {
                /* API helper shows toast */
                closeConfirmModal();
                setLoading(false); // Moved here
            }
             // NO finally block
        });
    }, [api, editingProblem, showToast, setLoading, setAllMetrics, setEditingProblem, openConfirmModal, closeConfirmModal]);


    // --- Discussion Handlers ---
    const handlePostSubmit = useCallback(async (title: string, content: string) => { if (!selectedProblem) { showToast("Lỗi: Không có bài toán được chọn.", "error"); return; } if (!currentUser) { showToast("Bạn cần đăng nhập để đăng bài.", "error"); return; } setLoading(true); try { const data = await api.post('/discussion/posts', { title, content, problemId: selectedProblem.id }); await fetchAllData(); setShowNewPostModal(false); setViewingPost(data.post); showToast("Đăng bài thành công!", "success"); } catch (err) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, selectedProblem, currentUser, showToast, setLoading, fetchAllData, setShowNewPostModal, setViewingPost ]);
    const handleCommentSubmit = useCallback(async (postId: number, content: string, parentId: number | null) => { if (!currentUser) { showToast("Bạn cần đăng nhập để bình luận.", "error"); return; } try { const data = await api.post('/discussion/comments', { content, postId, parentId }); setReplyingTo(null); setComments(prev => [...prev, data.comment]); showToast("Bình luận thành công!", "success"); await fetchAllData(); } catch (err) { /* API helper shows toast */ await fetchAllData(); } }, [api, currentUser, showToast, setReplyingTo, setComments, fetchAllData]);
    const handleVote = useCallback(async (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => {
        if (!currentUser) {
            showToast("Bạn cần đăng nhập để bỏ phiếu.", "error");
            return;
        }
        const key = `${targetType}-${targetId}`;
        if (votingKey === key) return; // prevent spam/double taps while in-flight
        setVotingKey(key);
        const endpoint = `/discussion/${targetType}/${targetId}/vote`;
        try {
            const data = await api.post(endpoint, { voteType });
            if (targetType === 'posts') {
                setPosts(prev => prev.map(p => p.id === targetId ? data.post : p));
                if (viewingPost?.id === targetId) setViewingPost(data.post);
            } else {
                setComments(prev => prev.map(c => c.id === targetId ? data.comment : c));
            }
        } catch (err: any) {
            const msg = err?.message || "Bỏ phiếu thất bại.";
            showToast(msg, "error");
            await fetchAllData();
        } finally {
            setVotingKey(null);
        }
    }, [api, currentUser, viewingPost, fetchAllData, showToast, setPosts, setViewingPost, setComments, votingKey]);
    const handleUpdatePost = useCallback(async (postId: number, title: string, content: string) => { setLoading(true); try { const data = await api.put(`/discussion/posts/${postId}`, { title, content }); setPosts(prev => prev.map(p => p.id === postId ? data.post : p)); if (viewingPost?.id === postId) setViewingPost(data.post); setEditingItemId(null); setEditingItemType(null); showToast("Cập nhật bài viết thành công.", "success"); } catch (e) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, setLoading, setPosts, viewingPost, setViewingPost, setEditingItemId, setEditingItemType, showToast]);
    // *** MODIFIED handleDeletePost: Removed finally, moved setLoading(false) ***
    const handleDeletePost = useCallback((postId: number) => {
        openConfirmModal("Xóa bài viết?", "Hành động này sẽ xóa bài viết và tất cả bình luận liên quan.", async () => {
            setLoading(true);
            try {
                await api.delete(`/discussion/posts/${postId}`);
                setPosts(prev => prev.filter(p => p.id !== postId));
                setComments(prev => prev.filter(c => c.postId !== postId));
                if (viewingPost?.id === postId) setViewingPost(null);
                closeConfirmModal();
                showToast("Xóa bài viết thành công.", "success");
                setLoading(false); // Moved here
            } catch (e) {
                /* API helper shows toast */
                closeConfirmModal();
                setLoading(false); // Moved here
            }
             // NO finally block
        });
    }, [api, setLoading, setPosts, setComments, viewingPost, setViewingPost, openConfirmModal, closeConfirmModal, showToast]);

    const handleUpdateComment = useCallback(async (commentId: number, content: string) => { setLoading(true); try { const data = await api.put(`/discussion/comments/${commentId}`, { content }); setComments(prev => prev.map(c => c.id === commentId ? data.comment : c)); setEditingItemId(null); setEditingItemType(null); showToast("Cập nhật bình luận thành công.", "success"); } catch (e) { /* API helper shows toast */ } finally { setLoading(false); } }, [api, setLoading, setComments, setEditingItemId, setEditingItemType, showToast]);
    // *** MODIFIED handleDeleteComment: Removed finally, moved setLoading(false) ***
    const handleDeleteComment = useCallback((commentId: number) => {
        openConfirmModal("Xóa bình luận?", "Hành động này sẽ xóa bình luận này và tất cả các trả lời con. Không thể hoàn tác.", async () => {
            setLoading(true);
            try {
                await api.delete(`/discussion/comments/${commentId}`);
                const getRepliesRecursive = (id: number, all: DiscussionComment[]): number[] => {
                    const directChildren = all.filter(c => c.parentId === id).map(c => c.id);
                    return directChildren.reduce<number[]>((acc, childId) => {
                        return acc.concat([childId, ...getRepliesRecursive(childId, all)]);
                    }, []);
                };
                const repliesToDelete = getRepliesRecursive(commentId, comments);
                setComments(prev => prev.filter(c => c.id !== commentId && !repliesToDelete.includes(c.id))); // Optimistic removal
                closeConfirmModal();
                showToast("Xóa bình luận thành công.", "success");
                await fetchAllData(); // Re-fetch for consistency
                setLoading(false); // Moved here
            } catch (e) {
                /* API helper shows toast */
                closeConfirmModal();
                await fetchAllData(); // Re-fetch on error too
                setLoading(false); // Moved here
            }
             // NO finally block
        });
    }, [api, setLoading, comments, setComments, openConfirmModal, closeConfirmModal, showToast, fetchAllData]);


    // --- Hint Handler ---
    const handleGetHint = useCallback(async () => {
        if (!selectedProblem) return;
        setIsGeneratingHint(true);
        setProblemHint(null);
        setError('');

        if (!currentUser) {
            showToast("Bạn đang xem với tư cách khách. Gợi ý sẽ ở mức cơ bản.", "info");
        }

        try {
            const data = await api.post(`/problems/${selectedProblem.id}/hint`);
            if (data?.warning) {
                showToast(data.warning, 'info');
            }
            if (!data?.hint) {
                throw new Error("Không nhận được gợi ý.");
            }
            setProblemHint(data.hint);
        } catch (e: any) {
            showToast(`Lỗi gợi ý: ${e.message || 'Không thể tạo gợi ý lúc này.'}`, 'error');
            console.error("Hint Error:", e);
        } finally {
            setIsGeneratingHint(false);
        }
    }, [selectedProblem, currentUser, api, showToast]);

    // --- Dataset Download ---
    const downloadDataset = useCallback((content: string | undefined, filename: string) => { if (!content) { showToast(`Nội dung cho file "${filename}" không có sẵn để tải về.`, "error"); return; } try { const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.setAttribute('download', filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } catch (e) { console.error("Download error:", e); showToast("Lỗi tải dataset.", "error"); } }, [showToast]);

     // --- Navigation to Profile ---
     const navigateToProfile = useCallback((userIdOrUsername: number | string) => { navigate('profile', userIdOrUsername); }, [navigate]);

      // --- Problem Submission Handler ---
     const handleProblemSubmit = useCallback(async (formData: FormData) => { setLoading(true); try { const data = await api.post("/submissions", formData); await fetchAllData(); setSubmissions(prev => [data.submission, ...prev.filter(s => s.problemId !== data.submission.problemId || s.userId !== data.submission.userId)]); showToast("Nộp bài thành công! Kết quả sẽ sớm được cập nhật.", "success"); setRightPanelTab("submissions"); } catch (submitError: any) { console.error("Submission failed:", submitError); } finally { setLoading(false); } }, [api, setLoading, fetchAllData, showToast, setRightPanelTab, setSubmissions]);


    // --- CONTEXT VALUE ---
    const contextValue = useMemo(() => ({
        currentUser, setCurrentUser, users, setUsers, problems, setProblems, allTags, setAllTags, allMetrics, setAllMetrics,
        submissions, setSubmissions, posts, setPosts, comments, setComments, leaderboardData, setLeaderboardData, page, setPage,
        editingProblem, setEditingProblem, currentView, setCurrentView, authMode, setAuthMode, selectedProblem, setSelectedProblem,
        viewingUserId, setViewingUserId, loading, setLoading, error, setError, confirmModal, setConfirmModal,
        imgSrc, setImgSrc, isAvatarModalOpen, setIsAvatarModalOpen, originalFileName, setOriginalFileName,
        problemHint, setProblemHint, isGeneratingHint, setIsGeneratingHint, leftPanelTab, setLeftPanelTab, rightPanelTab, setRightPanelTab,
        viewingPost, setViewingPost, showNewPostModal, setShowNewPostModal, replyingTo, setReplyingTo, adminSubPage, setAdminSubPage,
        toastMessage, toastType, editingItemId, setEditingItemId, editingItemType, setEditingItemType, votingKey, setVotingKey,
        api, fetchAllData, handleSignup, handleLogin, handleLogout, handleSaveProblem, handleDeleteProblem, handleSettingsUpdate, handleChangePassword, handleDeleteAccount,
        handleAdminUpdateUserRole, handleAdminToggleBanUser, handleAdminDeleteUser, handleAdminAddTag, handleAdminDeleteTag, handleAdminAddMetric, handleAdminDeleteMetric,
        handlePostSubmit, handleCommentSubmit, handleVote, handleGetHint, downloadDataset, openConfirmModal, closeConfirmModal, navigateToProfile,
        showToast, clearToast, handleProblemSubmit, handleAvatarUpdate,
        handleUpdatePost, handleDeletePost, handleUpdateComment, handleDeleteComment, navigate
    }), [ // Ensure all state and callbacks are listed
        currentUser, users, problems, allTags, allMetrics, submissions, posts, comments, leaderboardData, page, editingProblem, currentView, authMode,
        selectedProblem, viewingUserId, loading, error, confirmModal, imgSrc, isAvatarModalOpen, originalFileName,
        problemHint, isGeneratingHint, leftPanelTab, rightPanelTab, viewingPost, showNewPostModal, replyingTo, adminSubPage,
        toastMessage, toastType, editingItemId, editingItemType, votingKey, setVotingKey,
        api, fetchAllData, handleSignup, handleLogin, handleLogout, handleSaveProblem, handleDeleteProblem, handleSettingsUpdate, handleChangePassword, handleDeleteAccount,
        handleAdminUpdateUserRole, handleAdminToggleBanUser, handleAdminDeleteUser, handleAdminAddTag, handleAdminDeleteTag, handleAdminAddMetric, handleAdminDeleteMetric,
        handlePostSubmit, handleCommentSubmit, handleVote, handleGetHint, downloadDataset, openConfirmModal, closeConfirmModal, navigateToProfile,
        showToast, clearToast, handleProblemSubmit, handleAvatarUpdate,
        handleUpdatePost, handleDeletePost, handleUpdateComment, handleDeleteComment, navigate
    ]);


    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    ); // Line 568
}; // Line 569

