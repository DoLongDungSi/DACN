import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { ProblemEditorForm } from '../components/Problem/ProblemEditorForm';
import type { Problem } from '../types';
import { api } from '../api';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

// File C: Kế thừa logic từ B, nhưng giữ typing và tính tương thích của A.
// - Giữ signature typed của `handleSaveProblem` như A.
// - Giữ giao diện nâng cấp từ B (badge, header meta, admin role), nhưng
//   đảm bảo không phá vỡ integration contract với ProblemEditorForm hay API.

export const ProblemEditorPage: React.FC = () => {
    const {
        editingProblem,
        setEditingProblem,
        allTags,
        allMetrics,
        loading: globalLoading,
        setLoading: setGlobalLoading,
        currentUser,
        fetchAllData,
        setError,
        showToast,
        navigate,
    } = useAppContext();

    const isNew = editingProblem === 'new';
    const [pageError, setPageError] = useState('');
    const [isFetchingDetail, setIsFetchingDetail] = useState(false);
    const [fullProblemDetail, setFullProblemDetail] = useState<Problem | 'new' | null>(null);

    // Roles that may access the editor. Keep in sync with backend role naming.
    const allowedRoles = new Set(['owner', 'creator', 'admin']);

    // Authorization check (client-side; backend must still enforce)
    if (!currentUser || !allowedRoles.has(currentUser.role)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-md mx-4">
                    <h2 className="text-2xl font-bold text-red-600 mb-3">Truy cập bị từ chối</h2>
                    <p className="text-slate-600 mb-6">Bạn cần quyền Creator hoặc Admin để truy cập trang này.</p>
                    <button
                        onClick={() => navigate('problems')}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        );
    }

    // Fetch full detail when editing an existing problem
    useEffect(() => {
        const loadDetail = async () => {
            if (editingProblem === 'new') {
                setFullProblemDetail('new');
                return;
            }

            if (!editingProblem?.id) {
                // If we lost state (e.g. page refresh), redirect to list
                navigate('problems');
                return;
            }

            setIsFetchingDetail(true);
            try {
                console.log(`Fetching full detail for problem ID: ${editingProblem.id}`);
                const data = await api.get(`/problems/${editingProblem.id}`);

                if (data?.problem) {
                    console.log('Full detail loaded:', data.problem);
                    setFullProblemDetail(data.problem as Problem);
                } else {
                    throw new Error('Dữ liệu trả về từ server không hợp lệ.');
                }
            } catch (e: any) {
                console.error('Error fetching problem detail:', e);
                const msg = e?.response?.data?.message || e?.message || 'Không thể tải chi tiết bài toán (Script/Data).';
                showToast(msg, 'error');
                setPageError('Lỗi kết nối đến server. Vui lòng thử lại.');
            } finally {
                setIsFetchingDetail(false);
            }
        };

        loadDetail();
    }, [editingProblem, api, showToast, navigate]);

    // Merge of A's typing with B's behavior
    const handleSaveProblem = async (
        data: Partial<Problem> & { evaluationScriptContent: string },
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null; coverImage: File | null },
    ) => {
        if (!currentUser) return;

        setGlobalLoading(true);
        setError('');
        setPageError('');

        try {
            const formData = new FormData();

            // Basic Validation for new problem
            if (isNew) {
                if (!files.trainFile || !files.testFile || !files.groundTruthFile) {
                    throw new Error('Vui lòng tải lên đủ 3 file: Train, Test và Ground Truth cho bài toán mới.');
                }
            }

            const dataToSend = {
                ...data,
                tagIds,
                metricIds,
                existingDatasets: (fullProblemDetail !== 'new' && fullProblemDetail?.datasets) ? fullProblemDetail.datasets : [],
            };

            console.log('Saving problem data:', dataToSend);

            if (files.trainFile) formData.append('trainCsv', files.trainFile);
            if (files.testFile) formData.append('testCsv', files.testFile);
            if (files.groundTruthFile) formData.append('groundTruthCsv', files.groundTruthFile);
            if (files.coverImage) formData.append('coverImage', files.coverImage);

            formData.append('problemData', JSON.stringify(dataToSend));

            if (isNew) {
                await api.post('/problems', formData);
                showToast('Tạo bài toán mới thành công!', 'success');
            } else if (fullProblemDetail && fullProblemDetail !== 'new') {
                // Final ownership check on client for better UX (server must still validate)
                if (currentUser.role !== 'admin' && fullProblemDetail.authorId !== currentUser.id) {
                    throw new Error('Bạn không có quyền chỉnh sửa bài toán này.');
                }

                await api.put(`/problems/${fullProblemDetail.id}`, formData);
                showToast('Cập nhật bài toán thành công!', 'success');
            }

            // Refresh global data and navigate back to list
            await fetchAllData();
            setEditingProblem(null);
            navigate('problems');
        } catch (e: any) {
            console.error('Save error:', e);
            const msg = e?.response?.data?.message || e?.message || 'Có lỗi xảy ra khi lưu bài toán.';
            setPageError(msg);
            showToast(msg, 'error');
            // Ensure user sees the error
            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleCancel = () => {
        // Keep B's confirm behavior but make it non-blocking when running tests if needed
        const confirmed = typeof window !== 'undefined' ? window.confirm('Bạn có chắc muốn hủy bỏ các thay đổi?') : true;
        if (confirmed) {
            setEditingProblem(null);
            navigate('problems');
            setError('');
            setPageError('');
        }
    };

    if (isFetchingDetail || !fullProblemDetail) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                {/* LoadingSpinner may or may not accept size prop; cast to any to avoid TS issues in mixed codebases */}
                <LoadingSpinner {...({ size: 'lg' } as any)} />
                <span className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu bài toán...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20 font-sans">
            <div className="bg-white border-b border-slate-200 mb-8 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleCancel}
                            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full transition-colors"
                            title="Quay lại danh sách"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>

                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold text-slate-800 leading-tight">
                                {isNew ? 'Tạo cuộc thi mới' : `Chỉnh sửa: ${(fullProblemDetail as Problem).name}`}
                            </h1>
                            <span className="text-xs text-slate-500 font-medium">
                                {isNew ? 'Bản nháp chưa lưu' : `ID: ${(fullProblemDetail as Problem).id} • Cập nhật lần cuối: ${new Date().toLocaleString('vi-VN')}`}
                            </span>
                        </div>
                    </div>

                    <div className="hidden sm:block">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isNew ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isNew ? 'Creating' : 'Editing'} Mode
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {pageError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 shadow-sm animate-fade-in">
                        <div className="mt-0.5 font-bold">Lỗi:</div>
                        <div>{pageError}</div>
                    </div>
                )}

                <ProblemEditorForm
                    initialProblem={fullProblemDetail}
                    onSave={handleSaveProblem}
                    onCancel={handleCancel}
                    allTags={allTags}
                    allMetrics={allMetrics}
                    loading={globalLoading}
                />
            </div>
        </div>
    );
};
