import React from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useAppContext } from '../hooks/useAppContext';
import { Problem } from '../types'; // Import Problem type if not already globally available

export const MySubmissionsPage: React.FC = () => {
    const { submissions, currentUser, problems, setPage, setSelectedProblem } = useAppContext();

    if (!currentUser) {
        // Optionally redirect to login or show a message
        return <p className="p-8 text-center text-slate-500">Vui lòng đăng nhập để xem bài nộp.</p>;
    }

    const mySubmissions = submissions
        .filter((s) => s.userId === currentUser?.id)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const getProblemName = (problemId: number): string => {
        const problem = problems.find((p: Problem) => p.id === problemId);
        return problem?.name || 'Unknown Problem';
    };

     const handleProblemClick = (problemId: number) => {
        const problem = problems.find((p) => p.id === problemId);
        if (problem) {
            setSelectedProblem(problem);
            setPage('problem-detail');
        }
    };


    return (
        <div>
            <h2 className="text-3xl font-bold mb-8 text-slate-900">Các bài đã nộp</h2>
            {mySubmissions.length === 0 ? (
                 <p className="text-center text-slate-500 py-10">Bạn chưa nộp bài nào.</p>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Bài toán</th>
                                <th className="p-4 text-right text-xs font-semibold uppercase text-slate-500 tracking-wider">Điểm</th>
                                <th className="p-4 text-right text-xs font-semibold uppercase text-slate-500 tracking-wider">Runtime</th>
                                <th className="p-4 text-left text-xs font-semibold uppercase text-slate-500 tracking-wider">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {mySubmissions.map((sub) => (
                                <tr key={sub.id} className="hover:bg-slate-50/50">
                                    <td className="p-4 font-medium text-slate-800">
                                        <button
                                            onClick={() => handleProblemClick(sub.problemId)}
                                            className="text-indigo-600 hover:underline"
                                            title={`Xem chi tiết bài toán ${getProblemName(sub.problemId)}`}
                                            >
                                                {getProblemName(sub.problemId)}
                                        </button>
                                    </td>
                                    <td className="p-4 font-mono text-right">{sub.publicScore?.toFixed(4) ?? 'N/A'}</td>
                                    <td className="p-4 font-mono text-right text-slate-600">{sub.runtimeMs?.toFixed(0) ?? 'N/A'} ms</td>
                                    <td className="p-4 text-slate-500">
                                        {sub.submittedAt ? formatDistanceToNow(parseISO(sub.submittedAt), { addSuffix: true }) : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
        </div>
    );
};
