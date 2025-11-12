import React, { useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import remarkMath from 'remark-math'; // Import remarkMath
import rehypeKatex from 'rehype-katex'; // Import rehypeKatex
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import { ArrowLeft, Lightbulb, DownloadCloud, FileText, BarChart3, MessageSquare, Upload } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useAppContext } from '../hooks/useAppContext';
import type { Submission, LeaderboardEntry, Dataset } from '../types';
import { DiscussionComponent } from '../components/Discussion';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

export const ProblemDetailPage: React.FC = () => {
    const {
        selectedProblem, setSelectedProblem, submissions, currentUser, loading,
        problemHint, setProblemHint, isGeneratingHint, leftPanelTab, setLeftPanelTab,
        rightPanelTab, setRightPanelTab, handleGetHint, downloadDataset,
        navigateToProfile, handleProblemSubmit, leaderboardData, navigate, showToast,
    } = useAppContext();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset hint when problem changes
    useEffect(() => { setProblemHint(null); }, [selectedProblem, setProblemHint]);

    // Redirect if no problem selected
    useEffect(() => {
        if (!loading && !selectedProblem) {
            console.warn("No selected problem found after load. Redirecting.");
            navigate('problems', null, true);
        }
    }, [selectedProblem, loading, navigate]);

    if (!selectedProblem) {
        return loading
            ? <div className="p-8 text-center text-slate-500 flex justify-center items-center"><LoadingSpinner /><span className="ml-2">Đang tải bài toán...</span></div>
            : <div className="p-8 text-center text-slate-500">Không tìm thấy bài toán. Đang chuyển hướng...</div>;
    }

    const mySubmissions = submissions
        .filter((s: Submission) => s.userId === currentUser?.id && s.problemId === selectedProblem.id)
        .sort((a, b) => {
            const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
            return dateB - dateA; // Most recent first
        });

    const currentLeaderboard = leaderboardData[selectedProblem.id] || [];

    const handleDatasetDownload = useCallback(async (dataset: Dataset | null | undefined) => {
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
                    throw new Error(text || `Không tải được dataset (${response.status}).`);
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
                showToast(error.message || 'Không thể tải dataset.', 'error');
            }
            return;
        }
        showToast('Dataset này chưa sẵn sàng để tải.', 'info');
    }, [downloadDataset, showToast]);

    const handleSubmitClick = () => {
        if (!selectedProblem) return;
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            console.error("No file selected");
             // Consider using showToast("Vui lòng chọn file nộp bài.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("problemId", selectedProblem.id.toString());
        formData.append("submissionFile", file); // Backend expects 'submissionFile'
        handleProblemSubmit(formData).then(() => {
             if (fileInputRef.current) {
                 fileInputRef.current.value = "";
             }
         });
    };

    // Helper for difficulty badge styling
     const getDifficultyClass = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'bg-green-100 text-green-800 border-green-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'hard': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };


    return (
        // Added gradient background and padding similar to editor page
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Back Button and Title Area */}
                <div className="mb-8">
                     <button
                        onClick={() => { navigate('problems'); setSelectedProblem(null); }}
                        className="text-indigo-600 font-semibold mb-3 flex items-center group text-sm hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 rounded"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Quay lại danh sách bài toán
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                         <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mr-4">
                            {selectedProblem.name || 'Unnamed Problem'}
                        </h1>
                         <span className={`px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider flex-shrink-0 ${getDifficultyClass(selectedProblem.difficulty)}`}>
                            {selectedProblem.difficulty}
                        </span>
                    </div>
                </div>


                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left Panel */}
                    <div className="lg:col-span-3 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                         {/* Tabs */}
                        <div className="border-b border-slate-200 px-4 sm:px-6">
                            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Problem Details">
                                 <button onClick={() => setLeftPanelTab("description")} className={`tab-button ${leftPanelTab === 'description' ? 'tab-active' : 'tab-inactive'}`}> <FileText className="tab-icon"/> Mô tả </button>
                                 <button onClick={() => setLeftPanelTab("discussion")} className={`tab-button ${leftPanelTab === 'discussion' ? 'tab-active' : 'tab-inactive'}`}> <MessageSquare className="tab-icon"/> Thảo luận </button>
                                 <button onClick={() => setLeftPanelTab("datasets")} className={`tab-button ${leftPanelTab === 'datasets' ? 'tab-active' : 'tab-inactive'}`}> <DownloadCloud className="tab-icon"/> Dữ liệu </button>
                            </nav>
                        </div>
                        {/* Tab Content */}
                        <div className="p-4 sm:p-6">
                             {leftPanelTab === 'description' && (
                                <div>
                                     {/* Use ReactMarkdown for rendering description */}
                                    <article className="prose prose-sm sm:prose-base max-w-none prose-slate prose-headings:font-semibold prose-a:text-indigo-600 hover:prose-a:text-indigo-800 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:text-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-pre:bg-slate-800 prose-pre:text-slate-200 prose-pre:rounded-lg prose-table:border prose-th:p-2 prose-td:p-2">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {selectedProblem.content || '*Không có mô tả.*'}
                                        </ReactMarkdown>
                                    </article>

                                    {/* Hint Section */}
                                    <div className="mt-8 pt-6 border-t border-slate-200">
                                         <h4 className="text-md font-semibold mb-3 text-slate-700">Cần trợ giúp?</h4>
                                        <button onClick={handleGetHint} disabled={isGeneratingHint || loading} className="hint-button">
                                            <Lightbulb className="w-4 h-4 mr-2" />
                                            {isGeneratingHint ? 'Đang lấy gợi ý...' : (problemHint ? 'Xem gợi ý' : 'Lấy gợi ý AI ✨')}
                                        </button>
                                        {isGeneratingHint && <LoadingSpinner overlay={false}/>}
                                        {problemHint && !isGeneratingHint && <div className="hint-display"><ReactMarkdown>{problemHint}</ReactMarkdown></div>}
                                    </div>
                                </div>
                            )}
                            {leftPanelTab === 'discussion' && <DiscussionComponent problemId={selectedProblem.id} />}
                            {leftPanelTab === 'datasets' && (
                                <div>
                                    <h3 className="text-xl font-semibold mb-4 text-slate-800">Tải dữ liệu</h3>
                                     {Array.isArray(selectedProblem.datasets) && selectedProblem.datasets.length > 0 ? (
                                        <div className="grid sm:grid-cols-2 gap-4">
                                            {selectedProblem.datasets.map((d, i) => (
                                                d ? (
                                                    <button
                                                        key={`${d.split}-${i}`}
                                                        onClick={() => handleDatasetDownload(d)}
                                                        disabled={!d.content && !d.downloadUrl}
                                                        className={`download-button ${(!d.content && !d.downloadUrl) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        title={(!d.content && !d.downloadUrl) ? 'Dataset chưa sẵn sàng.' : `Tải ${d.filename || d.split}`}
                                                    >
                                                        <DownloadCloud className="w-5 h-5 flex-shrink-0" /> <span className="truncate">{d.filename || d.split || `Dataset ${i + 1}`}</span>
                                                    </button>
                                                 ) : null
                                            ))}
                                        </div>
                                     ) : <p className="text-slate-500 text-sm italic">Không có dữ liệu công khai cho bài toán này.</p> }
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Submit Panel */}
                        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                            <h3 className="text-xl font-semibold mb-4 text-slate-800 flex items-center"><Upload className="w-5 h-5 mr-2 text-indigo-600"/>Nộp bài giải</h3>
                             <p className="mb-4 text-slate-600 text-sm"> Tải lên file kết quả <code className="code-inline">submission.csv</code>. </p>
                            <div className="space-y-4">
                                 <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv" // Accept only CSV for submission
                                    className="file-input-style" // Re-use style
                                    disabled={loading || !currentUser}
                                    aria-label="Chọn file nộp bài"
                                />
                                 <button onClick={handleSubmitClick} disabled={loading || !currentUser} className="submit-button w-full"> {/* Make button full width */}
                                    {loading ? <LoadingSpinner size="sm" /> : 'Nộp bài'}
                                </button>
                                {!currentUser && <p className="text-xs text-red-600 text-center">Bạn cần đăng nhập để nộp bài.</p>}
                            </div>
                        </div>

                        {/* Leaderboard / My Submissions Panel */}
                        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                            {/* Tabs */}
                            <div className="border-b border-slate-200 px-4 sm:px-6">
                                 <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Results">
                                    <button onClick={() => setRightPanelTab("leaderboard")} className={`tab-button ${rightPanelTab === 'leaderboard' ? 'tab-active' : 'tab-inactive'}`}> <BarChart3 className="tab-icon"/> Bảng xếp hạng </button>
                                    {currentUser && <button onClick={() => setRightPanelTab("submissions")} className={`tab-button ${rightPanelTab === 'submissions' ? 'tab-active' : 'tab-inactive'}`}> <FileText className="tab-icon"/> Bài nộp của tôi </button>}
                                </nav>
                            </div>
                            {/* Tab Content */}
                             <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                                 {rightPanelTab === 'leaderboard' && (
                                    <div>
                                        {Array.isArray(currentLeaderboard) && currentLeaderboard.length > 0 ? (
                                            <table className="table-fixed w-full text-sm">
                                                 <thead> <tr className="bg-slate-50 sticky top-0 z-10 shadow-sm"> <th className="table-header text-center w-14">Hạng</th> <th className="table-header w-2/5">Người dùng</th> <th className="table-header text-right w-1/4">Điểm</th> <th className="table-header text-right">Thời gian</th> </tr> </thead>
                                                 <tbody className="divide-y divide-slate-100">
                                                    {currentLeaderboard.map((entry) => (
                                                        <tr key={entry.subId} className={`hover:bg-slate-50/50 transition-colors ${entry.username === currentUser?.username ? 'bg-indigo-50/50 font-semibold' : ''}`}>
                                                            <td className="table-cell text-center font-bold text-indigo-600">{entry.rank !== undefined ? `#${entry.rank}` : '-'}</td>
                                                            <td className="table-cell truncate">
                                                                {entry.username ? (
                                                                    <button onClick={() => navigateToProfile(entry.username)} className="link-button block w-full text-left truncate"> {entry.username} </button>
                                                                 ) : ( <span className="text-slate-400 italic">Unknown</span> )}
                                                            </td>
                                                            <td className="table-cell text-right font-mono text-slate-700">{typeof entry.score === 'number' ? entry.score.toFixed(4) : 'N/A'}</td>
                                                            <td className="table-cell text-right text-xs text-slate-500">{entry.time ? formatDistanceToNow(parseISO(entry.time), { addSuffix: true }) : 'N/A'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                         ) : <p className="table-empty-msg">Chưa có ai trên bảng xếp hạng.</p> }
                                    </div>
                                )}
                                {rightPanelTab === 'submissions' && currentUser && (
                                    <div>
                                         {Array.isArray(mySubmissions) && mySubmissions.length > 0 ? (
                                            <table className="table-fixed w-full text-sm">
                                                 <thead> <tr className="bg-slate-50 sticky top-0 z-10 shadow-sm"> <th className="table-header w-1/3">Điểm</th> <th className="table-header w-1/4">Runtime</th> <th className="table-header">Thời gian nộp</th> </tr> </thead>
                                                 <tbody className="divide-y divide-slate-100">
                                                    {mySubmissions.map((sub) => (
                                                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="table-cell font-mono text-slate-700">{typeof sub.publicScore === 'number' ? sub.publicScore.toFixed(4) : 'N/A'}</td>
                                                            <td className="table-cell font-mono text-slate-600">{typeof sub.runtimeMs === 'number' ? `${sub.runtimeMs.toFixed(0)} ms` : 'N/A'}</td>
                                                            <td className="table-cell text-xs text-slate-500">{sub.submittedAt ? formatDistanceToNow(parseISO(sub.submittedAt), { addSuffix: true }) : 'N/A'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                         ) : <p className="table-empty-msg">Bạn chưa nộp bài nào cho bài toán này.</p> }
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                 {/* Styles */}
                 <style>{`
                    .tab-icon { width: 1rem; height: 1rem; margin-right: 0.5rem; flex-shrink: 0; }
                    .tab-button { display: flex; align-items: center; white-space: nowrap; padding: 1rem 0.5rem; border-bottom-width: 2px; font-weight: 600; font-size: 0.875rem; line-height: 1.25rem; transition: color 150ms ease-in-out, border-color 150ms ease-in-out; }
                    .tab-active { border-color: #6366f1; color: #4f46e5; }
                    .tab-inactive { border-color: transparent; color: #64748b; } .tab-inactive:hover { color: #334155; border-color: #cbd5e1; }
                    .hint-button { background-color: #fef3c7; color: #92400e; padding: 0.5rem 1rem; border-radius: 0.5rem; display: inline-flex; align-items: center; font-weight: 600; font-size: 0.875rem; line-height: 1.25rem; transition: background-color 150ms ease-in-out; border: 1px solid #fde68a; } .hint-button:hover { background-color: #fde68a; } .hint-button:disabled { opacity: 0.6; cursor: not-allowed; }
                    .hint-display { margin-top: 1rem; padding: 1rem; background-color: #f8fafc; border-radius: 0.5rem; color: #1e293b; border: 1px solid #e2e8f0; font-size: 0.875rem; line-height: 1.5; white-space: pre-wrap; }
                    .download-button { background-color: #16a34a; color: white; padding: 0.75rem 1rem; border-radius: 0.5rem; font-weight: 600; transition: background-color 150ms ease-in-out; display: flex; align-items: center; justify-content: center; column-gap: 0.5rem; font-size: 0.875rem; line-height: 1.25rem; border: 1px solid #15803d; } .download-button:hover { background-color: #15803d; }
                    .file-input-style { display: block; width: 100%; font-size: 0.875rem; line-height: 1.25rem; color: #64748b; padding: 0.25rem; file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 rounded-md }
                    .submit-button { background-color: #4f46e5; color: white; padding-top: 0.75rem; padding-bottom: 0.75rem; border-radius: 0.5rem; font-weight: 600; transition: all 150ms ease-in-out; display: flex; align-items: center; justify-content: center; min-height: 44px; /* Adjusted height */ } .submit-button:hover { background-color: #4338ca; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); } .submit-button:disabled { background-color: #a5b4fc; cursor: not-allowed; }
                    .table-header { padding: 0.75rem 1rem; text-align: left; font-semibold; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                    .table-cell { padding: 0.75rem 1rem; color: #334155; vertical-align: middle; }
                    .table-empty-msg { text-align: center; padding: 2rem; color: #64748b; font-size: 0.875rem; line-height: 1.25rem; font-style: italic; }
                    .link-button { color: #4f46e5; font-weight: 500; } .link-button:hover { text-decoration-line: underline; }
                    .code-inline { font-size: 0.875em; background-color: #f1f5f9; padding: 0.15em 0.4em; border-radius: 0.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; border: 1px solid #e2e8f0;}
                    /* Simple scrollbar */
                     .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
                     .scrollbar-thin::-webkit-scrollbar { width: 6px; }
                     .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
                     .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; border: 1px solid #f1f5f9; }
                     /* Prose adjustments for KaTeX */
                    .prose .katex-display { margin-left: 0; margin-right: 0; overflow-x: auto; }
                    .prose code { font-weight: 500; }
                 `}</style>
            </div>
        </div>
    );
};
