import React, { useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, FileText, ArrowRight } from 'lucide-react';
import { formatDate, formatDuration, getStatusColor, getStatusText } from '../utils';

export const MySubmissionsPage: React.FC = () => {
    const { submissions, loading, currentUser } = useAppContext();
    const navigate = useNavigate();

    // Sắp xếp bài nộp mới nhất lên đầu
    const sortedSubmissions = useMemo(() => {
        if (!submissions) return [];
        return [...submissions].sort((a, b) => 
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
    }, [submissions]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <LoadingSpinner />
                <span className="ml-3 text-slate-500">Đang tải lịch sử...</span>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
                <h2 className="text-xl font-bold mb-2">Vui lòng đăng nhập</h2>
                <p>Bạn cần đăng nhập để xem lịch sử nộp bài.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900">Lịch sử nộp bài</h1>
                <p className="text-slate-500 mt-2">Theo dõi trạng thái và kết quả các bài dự thi của bạn.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {sortedSubmissions.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-medium text-slate-900">Chưa có bài nộp nào</h3>
                        <p className="text-sm mt-1">Hãy tham gia các cuộc thi và gửi bài dự đoán đầu tiên!</p>
                        <button 
                            onClick={() => navigate('/problems')}
                            className="mt-6 btn-primary"
                        >
                            Khám phá cuộc thi
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500 tracking-wider">
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Cuộc thi</th>
                                    <th className="px-6 py-4">Thời gian nộp</th>
                                    <th className="px-6 py-4">Trạng thái</th>
                                    <th className="px-6 py-4 text-right">Score</th>
                                    <th className="px-6 py-4 text-right">Runtime</th>
                                    <th className="px-6 py-4 text-center">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedSubmissions.map((sub) => {
                                    // [SAFE ACCESS] Xử lý tên bài toán an toàn để tránh crash
                                    const problemName = (sub as any).problemName || (sub as any).problem?.name || `Problem #${sub.problemId}`;
                                    
                                    return (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold">
                                                #{sub.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => navigate(`/problems/${sub.problemId}`)}
                                                    className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left"
                                                >
                                                    {problemName}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {formatDate(sub.submittedAt)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(sub.status)}`}>
                                                    {sub.status === 'succeeded' && <CheckCircle2 className="w-3 h-3"/>}
                                                    {sub.status === 'failed' && <XCircle className="w-3 h-3"/>}
                                                    {sub.status === 'running' && <LoadingSpinner size="xs"/>}
                                                    {getStatusText(sub.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600 text-base">
                                                {sub.publicScore !== null ? Number(sub.publicScore).toFixed(5) : '--'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-slate-500 font-mono">
                                                {formatDuration(sub.runtimeMs)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => navigate(`/problems/${sub.problemId}`)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                    title="Xem chi tiết"
                                                >
                                                    <ArrowRight className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};