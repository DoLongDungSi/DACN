import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppContext } from '../hooks/useAppContext';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { 
    Upload, FileText, Trophy, Download, CheckCircle2, XCircle, 
    List, Database, Edit, Trash2, Lock, Unlock, MessageSquare, 
    ChevronLeft, X, Send, AlertCircle, FileSpreadsheet, Trash, Tag,
    Sparkles, Crown, AlertTriangle // [THÊM] Import AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { formatFileName, formatDate, getStatusColor, getStatusText } from '../utils';
import type { Problem, Submission } from '../types';
import { DiscussionComponent } from '../components/Discussion';
import 'katex/dist/katex.min.css';

// [THÊM] Component Modal Xóa Cục Bộ - Đảm bảo luôn hiển thị đẹp
const DeleteProblemModal = ({ isOpen, onClose, onConfirm, isDeleting, problemName }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; isDeleting: boolean; problemName: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all scale-100">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Xóa bài toán?</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Bạn có chắc chắn muốn xóa <span className="font-bold text-slate-800">"{problemName}"</span>? 
                            <br/>Hành động này sẽ xóa toàn bộ dữ liệu, bài nộp và thảo luận liên quan. Không thể hoàn tác.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Hủy bỏ</button>
                    <button onClick={onConfirm} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-red-200">
                        {isDeleting ? <LoadingSpinner size="xs" color="white"/> : <Trash2 className="w-4 h-4"/>}
                        {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const extractHeadings = (markdown: string | undefined) => {
    if (!markdown) return [];
    const lines = markdown.split('\n');
    const headings = [];
    const regex = /^(#{1,3})\s+(.*)$/;
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(regex);
        if (match) {
            const level = match[1].length;
            const text = match[2].trim();
            const id = text.toLowerCase().replace(/[^\w]+/g, '-');
            headings.push({ level, text, id });
        }
    }
    return headings;
};

export const ProblemDetailPage: React.FC = () => {
    const params = useParams();
    const id = params.problemId || params.id;
    const navigate = useNavigate();
    
    // [FIX] Chỉ lấy những hàm cơ bản, không phụ thuộc vào confirmModal của Context
    const { 
        currentUser, showToast, setEditingProblem, 
        problemHint, setProblemHint, isGeneratingHint, handleGetHint, 
        subscription, startPremiumCheckout, allTags,
        fetchAllData // Để refresh list sau khi xóa
    } = useAppContext();
    
    const [problem, setProblem] = useState<Problem | null>(null);
    const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [pageLoading, setPageLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'discussion' | 'leaderboard' | 'my_submissions'>('overview');
    const [isSubmitDrawerOpen, setIsSubmitDrawerOpen] = useState(false);
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    
    // State cho Modal Xóa Cục bộ
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isOwner = currentUser && problem && (
        currentUser.id === problem.authorId || currentUser.role === 'owner' || currentUser.role === 'admin'
    );

    const isPremium = currentUser?.isPremium || subscription?.status === 'active';

    useEffect(() => {
        setProblemHint(null);
    }, [id, setProblemHint]);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!id) return;
            setPageLoading(true);
            try {
                const probRes = await api.get(`/problems/${id}`);
                setProblem(probRes.problem);
                
                api.get(`/submissions/leaderboard/${id}`).then(res => setLeaderboard(res.leaderboard || [])).catch(() => {});
                if (currentUser) {
                    api.get('/submissions/my').then(res => {
                        setMySubmissions(res.submissions.filter((s: Submission) => s.problemId === Number(id)));
                    }).catch(() => {});
                }
            } catch (err) { 
                console.error(err); 
            } finally { 
                setPageLoading(false); 
            }
        };
        fetchDetail();
    }, [id, currentUser]);

    // --- HANDLERS ---

    const handleEdit = () => { 
        if (problem) { 
            setEditingProblem(problem); 
            // Hỗ trợ cả 2 loại đường dẫn để tránh lỗi 404
            navigate(`/problems/${problem.id}/edit`); 
        } 
    };

    // Hàm gọi Modal xác nhận
    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    // Hàm thực thi xóa (Gọi API trực tiếp)
    const handleConfirmDelete = async () => {
        if (!problem) return;
        setIsDeleting(true);
        try {
            await api.delete(`/problems/${problem.id}`);
            showToast('Đã xóa bài toán thành công', 'success');
            
            // Refresh dữ liệu global
            await fetchAllData();
            
            // Chuyển hướng về trang danh sách
            navigate('/problems', { replace: true });
        } catch (err: any) {
            console.error(err);
            showToast(err.message || "Có lỗi xảy ra khi xóa bài toán.", "error");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleToggleFreeze = async () => {
        if (!problem) return;
        try {
            const res = await api.put(`/problems/${problem.id}/freeze`);
            if (res.success) {
                setProblem(prev => prev ? { ...prev, isFrozen: res.isFrozen } : null);
                showToast(res.message, 'success');
            }
        } catch (err: any) { showToast(err.message, "error"); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.csv')) { showToast('Chỉ chấp nhận file .csv', 'error'); return; }
            setSelectedFile(file); e.target.value = '';
        }
    };

    const handleSubmitPrediction = async () => {
        if (!selectedFile || !id) return;
        setSubmitting(true);
        const formData = new FormData();
        formData.append('submissionFile', selectedFile);
        formData.append('problemId', id);
        try {
            const res = await api.post('/submissions', formData);
            showToast(res.message || 'Nộp bài thành công!', 'success');
            
            const subRes = await api.get('/submissions/my');
            setMySubmissions(subRes.submissions.filter((s: Submission) => s.problemId === Number(id)));
            
            setSelectedFile(null); 
            setIsSubmitDrawerOpen(false); 
            setActiveTab('my_submissions');
        } catch (err: any) { 
            showToast(err.response?.data?.message || err.message || 'Lỗi nộp bài', 'error'); 
        } finally { 
            setSubmitting(false); 
        }
    };

    const handleDownloadDataset = async (fileName: string) => {
        if (!problem || !id) return;
        try {
            // [FIX] Sử dụng api.download để xử lý file binary
            const blob = await api.download(`/problems/${id}/download/${fileName}`);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a'); 
            link.href = url; 
            link.setAttribute('download', formatFileName(fileName)); 
            document.body.appendChild(link); 
            link.click(); 
            link.parentNode?.removeChild(link); 
            window.URL.revokeObjectURL(url);
        } catch (error) { 
            console.error("Download failed:", error);
            showToast("Không thể tải file. Vui lòng thử lại.", "error"); 
        }
    };

    const currentTOC = useMemo(() => {
        if (!problem) return [];
        if (activeTab === 'overview') return extractHeadings(problem.content);
        if (activeTab === 'data') return extractHeadings(problem.dataDescription);
        return [];
    }, [activeTab, problem]);

    if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
    if (!problem) return <div className="text-center p-20 text-slate-500 font-medium">Không tìm thấy bài toán hoặc đã bị xóa.</div>;

    const trainSet = problem.datasets?.find(d => d.split === 'train');
    const testSet = problem.datasets?.find(d => d.split === 'public_test');

    return (
        <div className="bg-[#F5F7FA] min-h-screen font-sans text-slate-900">
            {/* Modal Xóa Cục Bộ */}
            <DeleteProblemModal 
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
                problemName={problem.name}
            />

            {/* Header */}
            <div className="bg-white border-b border-slate-200 pt-8 px-6 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col md:flex-row gap-10 mb-8">
                        <div className="flex-1 min-w-0">
                            <button onClick={() => navigate('/problems')} className="flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 mb-4 uppercase tracking-wider transition-colors">
                                <ChevronLeft className="w-3 h-3 mr-1"/> Cuộc thi
                            </button>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 leading-tight flex items-center gap-3 tracking-tight">
                                {problem.name}
                                {problem.isFrozen && <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"><Lock className="w-3 h-3 mr-1"/> Locked</span>}
                            </h1>
                            <p className="text-lg text-slate-600 mb-6 leading-relaxed max-w-3xl">{problem.summary}</p>
                            <div className="flex flex-wrap gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border shadow-sm ${
                                    problem.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                    problem.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                    'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>{problem.difficulty}</span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-white text-slate-600 border border-slate-200 shadow-sm">{problem.problemType}</span>
                            </div>
                        </div>
                        <div className="flex-shrink-0 w-full md:w-80 flex flex-col gap-5">
                            {currentUser && (
                                <button onClick={() => setIsSubmitDrawerOpen(true)} disabled={problem.isFrozen} className="btn-primary w-full bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-300/50 py-4 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Send className="w-4 h-4" /> {problem.isFrozen ? 'Đóng nộp bài' : 'Submit Prediction'}
                                </button>
                            )}
                            {isOwner && (
                                <div className="flex items-center justify-end gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                                    <button onClick={handleEdit} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex-1 flex justify-center" title="Sửa"><Edit className="w-4 h-4" /></button>
                                    <button onClick={handleToggleFreeze} className={`p-2 hover:bg-amber-50 rounded-lg transition-all flex-1 flex justify-center ${problem.isFrozen ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'}`} title="Khóa">{problem.isFrozen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                    
                                    {/* Nút Xóa: Gọi hàm mở Modal cục bộ */}
                                    <button 
                                        onClick={handleDeleteClick} 
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-1 flex justify-center" 
                                        title="Xóa"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            {problem.coverImageUrl && (
                                <div className="w-full h-40 rounded-2xl overflow-hidden shadow-md border border-slate-100 relative group cursor-pointer">
                                    <img src={problem.coverImageUrl} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"/>
                                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-8 overflow-x-auto no-scrollbar border-b border-transparent">
                        {[{ id: 'overview', label: 'Tổng quan', icon: FileText }, { id: 'data', label: 'Dữ liệu', icon: Database }, { id: 'discussion', label: 'Thảo luận', icon: MessageSquare }, { id: 'leaderboard', label: 'Bảng xếp hạng', icon: Trophy }, { id: 'my_submissions', label: 'Bài nộp', icon: List }].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-[3px] transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
                                <tab.icon className="w-4 h-4" /> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[1400px] mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-9 space-y-8">
                        {activeTab === 'overview' && (
                            <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200 min-h-[400px]">
                                <section className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-indigo-600 prose-img:rounded-2xl">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]} components={{ h1: ({node, ...props}) => <h1 id={String(props.children).toLowerCase().replace(/[^\w]+/g, '-')} {...props} />, h2: ({node, ...props}) => <h2 id={String(props.children).toLowerCase().replace(/[^\w]+/g, '-')} {...props} />, h3: ({node, ...props}) => <h3 id={String(props.children).toLowerCase().replace(/[^\w]+/g, '-')} {...props} /> }}>
                                        {problem.content || '_Chưa có nội dung mô tả._'}
                                    </ReactMarkdown>
                                </section>
                            </div>
                        )}
                        {activeTab === 'data' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Database className="w-5 h-5 text-slate-400"/> Files</h3>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {trainSet && <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 transition-colors group cursor-pointer"><div className="flex justify-between items-start mb-2"><span className="font-bold text-slate-700 text-sm">Train Set</span><span className="text-[10px] font-mono bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-500">.CSV</span></div><span className="text-xs text-slate-500 mb-4 font-mono truncate" title={trainSet.fileName}>{formatFileName(trainSet.fileName)}</span><button onClick={() => handleDownloadDataset(trainSet.fileName)} className="mt-auto text-sm font-bold text-indigo-600 group-hover:underline flex items-center gap-1"><Download className="w-4 h-4"/> Download</button></div>}
                                        {testSet && <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 transition-colors group cursor-pointer"><div className="flex justify-between items-start mb-2"><span className="font-bold text-slate-700 text-sm">Test Set (Public)</span><span className="text-[10px] font-mono bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-500">.CSV</span></div><span className="text-xs text-slate-500 mb-4 font-mono truncate" title={testSet.fileName}>{formatFileName(testSet.fileName)}</span><button onClick={() => handleDownloadDataset(testSet.fileName)} className="mt-auto text-sm font-bold text-indigo-600 group-hover:underline flex items-center gap-1"><Download className="w-4 h-4"/> Download</button></div>}
                                    </div>
                                </div>
                                {problem.dataDescription && <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8"><h4 className="text-lg font-bold text-slate-900 mb-4">Metadata</h4><div className="prose prose-slate max-w-none prose-sm"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{problem.dataDescription}</ReactMarkdown></div></div>}
                            </div>
                        )}
                        {activeTab === 'discussion' && <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8"><DiscussionComponent problemId={problem.id} /></div>}
                        {activeTab === 'leaderboard' && (
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="font-bold text-slate-800 text-lg">Bảng xếp hạng</h3><span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Public Test</span></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white text-xs font-bold uppercase text-slate-500 border-b border-slate-100"><tr><th className="px-6 py-4 w-20 text-center">Rank</th><th className="px-6 py-4">User</th><th className="px-6 py-4 text-right">Score</th><th className="px-6 py-4 text-right">Entries</th><th className="px-6 py-4 text-right">Last</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {leaderboard.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-slate-500 italic">Chưa có dữ liệu.</td></tr> : leaderboard.map((entry, idx) => (
                                                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${entry.username === currentUser?.username ? 'bg-indigo-50/30' : ''}`}><td className="px-6 py-4 text-center">{idx < 3 ? <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${idx===0?'bg-amber-100 text-amber-700':idx===1?'bg-slate-200 text-slate-700':'bg-orange-100 text-orange-800'}`}>{idx+1}</span> : <span className="font-bold text-slate-400">{idx+1}</span>}</td><td className="px-6 py-4 font-bold text-slate-800"><button onClick={() => navigate(`/profile/${entry.username}`)} className="flex items-center gap-3 hover:text-indigo-600 transition-colors group"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-sm group-hover:scale-110 transition-transform" style={{backgroundColor: entry.avatarColor||'#6366f1'}}>{entry.username[0].toUpperCase()}</div>{entry.username}</button></td><td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">{Number(entry.score).toFixed(5)}</td><td className="px-6 py-4 text-right text-sm text-slate-500">{entry.submissionCount||1}</td><td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">{formatDate(entry.time)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeTab === 'my_submissions' && (
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800">Lịch sử nộp bài</h3></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white text-xs font-bold uppercase text-slate-500 border-b border-slate-100"><tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Thời gian</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-right">Score</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {mySubmissions.length === 0 ? <tr><td colSpan={4} className="p-12 text-center text-slate-500 italic">Bạn chưa nộp bài nào.</td></tr> : mySubmissions.map(sub => (
                                                <tr key={sub.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-mono text-xs text-slate-500">#{sub.id}</td><td className="px-6 py-4 text-sm text-slate-700">{formatDate(sub.submittedAt)}</td><td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(sub.status)}`}>{sub.status === 'succeeded' ? <CheckCircle2 className="w-3 h-3"/> : sub.status === 'failed' ? <XCircle className="w-3 h-3"/> : <LoadingSpinner size="xs"/>}{getStatusText(sub.status)}</span></td><td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">{sub.publicScore !== null ? Number(sub.publicScore).toFixed(5) : '--'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        <div className="sticky top-6 space-y-6">
                            {/* AI Assistant */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white"><Sparkles className="w-4 h-4" /></div>
                                    <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">AI Assistant</h4>
                                </div>
                                {!problemHint ? (
                                    <div className="text-center">
                                        <p className="text-xs text-slate-500 mb-3">Bí ý tưởng? Hãy để AI gợi ý hướng đi cho bạn.</p>
                                        <button onClick={isPremium ? handleGetHint : () => startPremiumCheckout()} disabled={isGeneratingHint} className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${isPremium ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:shadow-md'}`}>
                                            {isGeneratingHint ? <LoadingSpinner size="xs" color="white"/> : <>{!isPremium && <Crown className="w-3 h-3" />}{isPremium ? 'Lấy gợi ý ngay' : 'Mở khóa Premium'}</>}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-700 prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{problemHint}</ReactMarkdown></div>
                                        <button onClick={() => setProblemHint(null)} className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600">Đóng gợi ý</button>
                                    </div>
                                )}
                            </div>

                            {/* Tags Section */}
                            {problem.tags && problem.tags.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                    <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2 uppercase tracking-wide"><Tag className="w-4 h-4 text-slate-500"/> Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {problem.tags.map((tagId: any) => {
                                            const tagName = allTags.find(t => t.id === tagId)?.name || `Tag ${tagId}`;
                                            return (
                                                <span key={tagId} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors cursor-default">
                                                    {tagName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {((activeTab === 'overview' || activeTab === 'data') && currentTOC.length > 0) && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-200"><h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2"><List className="w-4 h-4"/> Mục lục</h4></div>
                                    <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {currentTOC.map((heading, idx) => (
                                            <a key={idx} href={`#${heading.id}`} className={`block text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg px-3 py-2 transition-all truncate border-l-2 border-transparent hover:border-slate-400 ${heading.level === 1 ? 'font-bold' : heading.level === 2 ? 'pl-5 text-slate-500' : 'pl-8 text-xs text-slate-400'}`} onClick={(e) => { e.preventDefault(); document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' }); }}>{heading.text}</a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isSubmitDrawerOpen && (
                <div className="fixed inset-0 z-[60] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSubmitDrawerOpen(false)}></div>
                    <div className="absolute inset-y-0 right-0 max-w-md w-full flex pointer-events-none">
                        <div className="pointer-events-auto h-full w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white"><div><h2 className="text-xl font-extrabold text-slate-900">Submit Prediction</h2><p className="text-sm text-slate-500 mt-1">Gửi kết quả dự đoán của bạn</p></div><button onClick={() => setIsSubmitDrawerOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div>
                            <div className="flex-1 p-8 overflow-y-auto bg-[#F8FAFC]">
                                <div className="space-y-6">
                                    {!selectedFile ? (
                                        <div className="border-2 border-dashed border-slate-300 bg-white rounded-3xl p-10 text-center cursor-pointer hover:border-slate-800 hover:bg-slate-50 transition-all group" onClick={() => fileInputRef.current?.click()}><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-slate-200 transition-all"><Upload className="w-8 h-8 text-slate-400 group-hover:text-slate-800" /></div><h3 className="text-lg font-bold text-slate-800 mb-1">Tải file CSV</h3><p className="text-sm text-slate-500">Nhấn để chọn file từ máy tính</p><input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileSelect} /></div>
                                    ) : (
                                        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group"><div className="flex items-start gap-4"><div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0"><FileSpreadsheet className="w-6 h-6"/></div><div className="flex-1 min-w-0"><p className="font-bold text-slate-900 truncate pr-6">{selectedFile.name}</p><p className="text-xs text-slate-500 mt-1 font-mono">{(selectedFile.size / 1024).toFixed(2)} KB</p></div></div><button onClick={() => setSelectedFile(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Xóa file"><Trash className="w-4 h-4"/></button><div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div></div>
                                    )}
                                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100"><h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4"/> Quy định nộp bài</h4><ul className="list-disc pl-5 space-y-2 text-sm text-blue-800/80"><li>File phải có định dạng <strong>.csv</strong>.</li><li>Cột <code>id</code> phải khớp với Test Set.</li><li>Mỗi ngày tối đa 10 lần nộp.</li></ul></div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 bg-white">{submitting ? <button disabled className="w-full flex justify-center items-center gap-2 bg-slate-100 text-slate-400 py-4 rounded-xl font-bold cursor-not-allowed"><LoadingSpinner size="sm"/> Đang xử lý...</button> : <button onClick={handleSubmitPrediction} disabled={!selectedFile} className="w-full bg-slate-900 text-white hover:bg-black py-4 rounded-xl font-bold shadow-xl shadow-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">Submit Prediction</button>}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};