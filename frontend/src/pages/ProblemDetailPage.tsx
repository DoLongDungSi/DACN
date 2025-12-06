import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
    ArrowLeft,
    DownloadCloud,
    Upload,
    Users,
    Gauge,
    Star,
    MessageSquare,
    FileText,
    BarChart3,
    Tag as TagIcon,
    Lightbulb,
    Crown,
    Database,
    Trophy,
    List,
    X,
    ChevronRight,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Send,
    File as FileIcon,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { useAppContext } from '../hooks/useAppContext';
import type { Submission, LeaderboardEntry, Dataset } from '../types';
import { DiscussionComponent } from '../components/Discussion';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

const formatSize = (bytes?: number | null) => {
    if (!bytes) return '---';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Extract headings from markdown for TOC
const extractHeadings = (markdown: string): { level: number; text: string; id: string }[] => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: { level: number; text: string; id: string }[] = [];
    let match;
    while ((match = headingRegex.exec(markdown)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        headings.push({ level, text, id });
    }
    return headings;
};

type TabId = 'overview' | 'data' | 'discussion' | 'leaderboard' | 'my-submissions';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'discussion', label: 'Discussion', icon: MessageSquare },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'my-submissions', label: 'My Submissions', icon: List },
];

const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-slate-400" />,
    running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    succeeded: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    failed: <XCircle className="w-4 h-4 text-rose-500" />,
};

const statusColors: Record<string, string> = {
    pending: 'text-slate-600 bg-slate-100',
    running: 'text-blue-600 bg-blue-100',
    succeeded: 'text-emerald-600 bg-emerald-100',
    failed: 'text-rose-600 bg-rose-100',
};

export const ProblemDetailPage: React.FC = () => {
    const {
        selectedProblem,
        submissions,
        currentUser,
        loading,
        problemHint,
        setProblemHint,
        isGeneratingHint,
        leftPanelTab,
        setLeftPanelTab,
        handleGetHint,
        downloadDataset,
        navigateToProfile,
        handleProblemSubmit,
        leaderboardData,
        navigate,
        showToast,
        allTags,
        allMetrics,
        subscription,
        startPremiumCheckout,
    } = useAppContext();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitDrawerOpen, setIsSubmitDrawerOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => { setProblemHint(null); }, [selectedProblem, setProblemHint]);

    useEffect(() => {
        if (!loading && !selectedProblem) {
            navigate('problems', null, true);
        }
    }, [selectedProblem, loading, navigate]);

    const handleTabChange = useCallback((tabId: TabId) => {
        setLeftPanelTab(tabId as any);
    }, [setLeftPanelTab]);

    if (!selectedProblem) {
        return loading ? (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner />
                <span className="ml-3 text-slate-500">Loading problem...</span>
            </div>
        ) : (
            <div className="p-8 text-center text-slate-500">No problem selected.</div>
        );
    }

    const mySubmissions = submissions
        .filter((s: Submission) => s.userId === currentUser?.id && s.problemId === selectedProblem.id)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const currentLeaderboard = leaderboardData[selectedProblem.id] || [];

    const handleDatasetDownload = async (dataset: Dataset | null | undefined) => {
        if (!dataset) return;
        const filename = dataset.filename || `${dataset.split || 'dataset'}.csv`;
        if (dataset.content) {
            downloadDataset(dataset.content, filename);
            return;
        }
        if (dataset.downloadUrl) {
            try {
                const response = await fetch(dataset.downloadUrl, { credentials: 'include' });
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || `Unable to download dataset (${response.status}).`);
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (error: any) {
                showToast(error.message || 'Failed to download dataset.', 'error');
            }
            return;
        }
        showToast('Dataset is not available for download.', 'info');
    };

    const tagNames = useMemo(() => {
        return selectedProblem.tags
            .map((id) => allTags.find((t) => t.id === id)?.name)
            .filter(Boolean) as string[];
    }, [selectedProblem.tags, allTags]);

    const participants = useMemo(() => {
        const ids = new Set<number>();
        submissions.forEach((s) => { if (s.problemId === selectedProblem.id) ids.add(s.userId); });
        return ids.size;
    }, [submissions, selectedProblem.id]);

    const metricLabel = useMemo(() => {
        const primaryId = selectedProblem.metricsLinks?.find((m) => m.isPrimary)?.metricId || selectedProblem.metrics?.[0];
        const metricObj = allMetrics.find((m) => m.id === primaryId);
        return metricObj?.key || 'Score';
    }, [selectedProblem.metricsLinks, selectedProblem.metrics, allMetrics]);

    const premiumLocked = !currentUser || (!currentUser.isPremium && subscription?.status !== 'active');

    // Extract TOC from current content
    const currentContent = useMemo(() => {
        if (leftPanelTab === 'overview') return selectedProblem.content || '';
        return '';
    }, [leftPanelTab, selectedProblem.content]);

    const tocHeadings = useMemo(() => extractHeadings(currentContent), [currentContent]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile || !currentUser) {
            if (!currentUser) showToast('Please login to submit.', 'error');
            return;
        }
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('problemId', String(selectedProblem.id));
        try {
            await handleProblemSubmit(formData);
            setSelectedFile(null);
            setIsSubmitDrawerOpen(false);
            handleTabChange('my-submissions');
        } catch (e) {
            // Error handled by context
        } finally {
            setIsSubmitting(false);
        }
    };

    const trainDataset = selectedProblem.datasets?.find(d => d.split === 'train');
    const testDataset = selectedProblem.datasets?.find(d => d.split === 'public_test');

    return (
        <div className="bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <button
                        onClick={() => navigate('problems')}
                        className="flex items-center text-slate-500 hover:text-slate-700 text-sm mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to competitions
                    </button>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                    selectedProblem.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                    selectedProblem.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                    'bg-rose-100 text-rose-700'
                                }`}>
                                    {selectedProblem.difficulty}
                                </span>
                                <span className="text-xs text-slate-500 uppercase tracking-wide">{selectedProblem.problemType}</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">{selectedProblem.name}</h1>
                            {tagNames.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {tagNames.map((tag) => (
                                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                                            <TagIcon className="w-3 h-3" /> {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-center px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-1 text-slate-600">
                                    <Users className="w-4 h-4" />
                                    <span className="font-semibold">{participants}</span>
                                </div>
                                <div className="text-xs text-slate-500">Teams</div>
                            </div>
                            <button
                                onClick={() => setIsSubmitDrawerOpen(true)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm"
                            >
                                <Upload className="w-4 h-4" /> Submit Prediction
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = leftPanelTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                                        isActive
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex gap-6">
                    {/* Main Panel */}
                    <div className="flex-1 min-w-0">
                        {leftPanelTab === 'overview' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-img:rounded-lg">
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm, remarkMath]} 
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                                h1: ({node, ...props}) => <h1 id={String(props.children).toLowerCase().replace(/[^a-z0-9]+/g, '-')} {...props} />,
                                                h2: ({node, ...props}) => <h2 id={String(props.children).toLowerCase().replace(/[^a-z0-9]+/g, '-')} {...props} />,
                                                h3: ({node, ...props}) => <h3 id={String(props.children).toLowerCase().replace(/[^a-z0-9]+/g, '-')} {...props} />,
                                            }}
                                        >
                                            {selectedProblem.content || '*No description yet.*'}
                                        </ReactMarkdown>
                                    </article>
                                </div>

                                {/* AI Hint Section */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-100 rounded-lg">
                                                <Lightbulb className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900">AI Hint</h3>
                                                <p className="text-xs text-slate-500">Get suggestions for approaching this problem</p>
                                            </div>
                                        </div>
                                        {premiumLocked && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                                                <Crown className="w-3 h-3" /> Premium Feature
                                            </span>
                                        )}
                                    </div>
                                    
                                    {!problemHint && !isGeneratingHint && (
                                        <button
                                            onClick={premiumLocked ? () => startPremiumCheckout() : handleGetHint}
                                            className={`w-full py-3 rounded-lg font-medium transition ${
                                                premiumLocked 
                                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                        >
                                            {premiumLocked ? 'Unlock with Premium' : 'Generate AI Hint'}
                                        </button>
                                    )}
                                    
                                    {isGeneratingHint && (
                                        <div className="flex items-center justify-center py-8">
                                            <LoadingSpinner />
                                            <span className="ml-3 text-slate-500">Generating hint...</span>
                                        </div>
                                    )}
                                    
                                    {problemHint && !isGeneratingHint && (
                                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                            <article className="prose prose-sm prose-slate max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                    {problemHint}
                                                </ReactMarkdown>
                                            </article>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {leftPanelTab === 'data' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Dataset Description</h2>
                                    <p className="text-slate-600 mb-6">
                                        Download the datasets below to get started. The training set contains labeled data for model development,
                                        while the test set is used for making predictions to submit.
                                    </p>
                                    
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {trainDataset && (
                                            <div className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-emerald-100 rounded-lg">
                                                            <Database className="w-5 h-5 text-emerald-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-slate-900">{trainDataset.filename || 'train.csv'}</h3>
                                                            <p className="text-xs text-slate-500">Training data</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{formatSize(trainDataset.sizeBytes)}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDatasetDownload(trainDataset)}
                                                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                                                >
                                                    <DownloadCloud className="w-4 h-4" /> Download
                                                </button>
                                            </div>
                                        )}
                                        
                                        {testDataset && (
                                            <div className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-100 rounded-lg">
                                                            <Database className="w-5 h-5 text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-slate-900">{testDataset.filename || 'test.csv'}</h3>
                                                            <p className="text-xs text-slate-500">Test data (for submission)</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{formatSize(testDataset.sizeBytes)}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDatasetDownload(testDataset)}
                                                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                                                >
                                                    <DownloadCloud className="w-4 h-4" /> Download
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {(!trainDataset && !testDataset) && (
                                        <div className="text-center py-8 text-slate-500">
                                            <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                            <p>No datasets available yet.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Submission Format Guide */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Submission Format</h2>
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <p className="text-sm text-slate-600 mb-3">
                                            Your submission should be a CSV file with the following format:
                                        </p>
                                        <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm overflow-x-auto">
{`id,prediction
0,1
1,0
2,1
...`}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}

                        {leftPanelTab === 'discussion' && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <DiscussionComponent problemId={selectedProblem.id} />
                            </div>
                        )}

                        {leftPanelTab === 'leaderboard' && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
                                    <p className="text-sm text-slate-500 mt-1">Public leaderboard based on {metricLabel}</p>
                                </div>
                                
                                {currentLeaderboard.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500">
                                        <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-medium">No submissions yet</p>
                                        <p className="text-sm">Be the first to submit!</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{metricLabel}</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {currentLeaderboard.map((entry: LeaderboardEntry, idx) => (
                                                    <tr key={entry.subId} className={`hover:bg-slate-50 ${entry.username === currentUser?.username ? 'bg-indigo-50' : ''}`}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                                                idx === 0 ? 'bg-amber-100 text-amber-700' :
                                                                idx === 1 ? 'bg-slate-200 text-slate-700' :
                                                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {entry.rank || idx + 1}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <button
                                                                onClick={() => navigateToProfile(entry.username)}
                                                                className="font-medium text-slate-900 hover:text-indigo-600 transition"
                                                            >
                                                                {entry.username}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-medium text-slate-900">
                                                            {entry.score.toFixed(5)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                                                            {formatDistanceToNow(parseISO(entry.time), { addSuffix: true })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {leftPanelTab === 'my-submissions' && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900">My Submissions</h2>
                                    <p className="text-sm text-slate-500 mt-1">Your submission history for this competition</p>
                                </div>
                                
                                {!currentUser ? (
                                    <div className="p-12 text-center text-slate-500">
                                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-medium">Login to view your submissions</p>
                                    </div>
                                ) : mySubmissions.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500">
                                        <FileIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-medium">No submissions yet</p>
                                        <p className="text-sm">Submit your first prediction!</p>
                                        <button
                                            onClick={() => setIsSubmitDrawerOpen(true)}
                                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                                        >
                                            <Upload className="w-4 h-4" /> Make Submission
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {mySubmissions.map((sub: Submission) => (
                                                    <tr key={sub.id} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">
                                                            #{sub.id}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[sub.status]}`}>
                                                                {statusIcons[sub.status]}
                                                                {sub.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                                                            {sub.status === 'succeeded' && sub.publicScore != null
                                                                ? sub.publicScore.toFixed(5)
                                                                : sub.status === 'failed'
                                                                ? <span className="text-rose-500">Error</span>
                                                                : <span className="text-slate-400">---</span>
                                                            }
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                                                            {format(parseISO(sub.submittedAt), 'MMM d, yyyy HH:mm')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Sidebar - TOC */}
                    {leftPanelTab === 'overview' && tocHeadings.length > 0 && (
                        <div className="hidden lg:block w-64 flex-shrink-0">
                            <div className="sticky top-20 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Table of Contents</h3>
                                <nav className="space-y-1">
                                    {tocHeadings.map((heading, idx) => (
                                        <a
                                            key={idx}
                                            href={`#${heading.id}`}
                                            className={`block text-sm text-slate-600 hover:text-indigo-600 transition py-1 ${
                                                heading.level === 1 ? '' :
                                                heading.level === 2 ? 'pl-3' :
                                                heading.level === 3 ? 'pl-6' : 'pl-9'
                                            }`}
                                        >
                                            {heading.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Submit Drawer */}
            {isSubmitDrawerOpen && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setIsSubmitDrawerOpen(false)}
                    />
                    <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900">Submit Prediction</h2>
                            <button
                                onClick={() => setIsSubmitDrawerOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="flex-1 p-6 overflow-y-auto">
                            {!currentUser ? (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium text-slate-900 mb-2">Login Required</p>
                                    <p className="text-sm text-slate-500 mb-4">Please login to submit your predictions.</p>
                                    <button
                                        onClick={() => {
                                            setIsSubmitDrawerOpen(false);
                                            // Navigate to login or show auth modal
                                        }}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                                    >
                                        Go to Login
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Upload your prediction file (CSV)
                                        </label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition"
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                accept=".csv"
                                                className="hidden"
                                            />
                                            {selectedFile ? (
                                                <div>
                                                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                                                    <p className="font-medium text-slate-900">{selectedFile.name}</p>
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        {(selectedFile.size / 1024).toFixed(1)} KB
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFile(null);
                                                        }}
                                                        className="mt-3 text-sm text-rose-600 hover:text-rose-700"
                                                    >
                                                        Remove file
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                                                    <p className="font-medium text-slate-700">Drop your CSV file here</p>
                                                    <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <h4 className="font-medium text-slate-900 mb-2">Submission Guidelines</h4>
                                        <ul className="text-sm text-slate-600 space-y-1">
                                            <li className="flex items-start gap-2">
                                                <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                                File must be in CSV format
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                                Include 'id' and 'prediction' columns
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                                Maximum file size: 50MB
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        {currentUser && (
                            <div className="p-6 border-t border-slate-200">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!selectedFile || isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Submit Prediction
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
