import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { ProblemEditorForm } from '../components/Problem/ProblemEditorForm';
import type { Problem } from '../types';
import { api } from '../api';

export const ProblemEditorPage: React.FC = () => {
    const {
        editingProblem,
        setEditingProblem,
        allTags,
        allMetrics,
        loading,
        setLoading,
        currentUser,
        fetchAllData,
        setError,
        showToast,
        navigate,
    } = useAppContext();

    const isNew = editingProblem === "new";
    const [pageError, setPageError] = useState('');

    // Authorization check
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'creator')) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 max-w-md mx-4">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Không có quyền truy cập</h2>
                    <p className="text-slate-600 mb-4">Bạn cần quyền Creator hoặc Owner để truy cập trang này.</p>
                    <button onClick={() => navigate('problems')} className="text-indigo-600 font-medium hover:underline">
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        );
    }

    if (!editingProblem) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                 <div className="text-slate-500">Đang tải hoặc không có bài toán nào được chọn...</div>
            </div>
        );
    }

    // Fetch full detail if needed
    useEffect(() => {
        const fetchDetailIfNeeded = async () => {
            if (!editingProblem || editingProblem === 'new') return;
            if (editingProblem.evaluationScript) return;
            try {
                const data = await api.get(`/problems/${editingProblem.id}`);
                if (data?.problem) {
                    setEditingProblem(data.problem);
                }
            } catch (e) {
                console.error("Error fetching problem detail:", e);
                showToast("Không thể tải chi tiết bài toán.", "error");
            }
        };
        fetchDetailIfNeeded();
    }, [editingProblem, api, setEditingProblem, showToast]);


    const handleSaveProblem = async (
        data: Partial<Problem> & { evaluationScriptContent: string },
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null; groundTruthFile: File | null },
    ) => {
        if (!currentUser) return;

        setLoading(true);
        setError("");
        setPageError("");

        try {
            const formData = new FormData();

            const dataToSend = {
                ...data,
                tagIds,
                metricIds,
                existingDatasets: (!isNew && editingProblem?.datasets) ? editingProblem.datasets : [],
            };

            if (files.groundTruthFile) {
                formData.append('groundTruthCsv', files.groundTruthFile, files.groundTruthFile.name);
            } else if (isNew) {
                throw new Error('Vui lòng tải lên file Ground Truth (đáp án) để chấm điểm.');
            }

            formData.append('problemData', JSON.stringify(dataToSend));
            if (files.trainFile) formData.append('trainCsv', files.trainFile);
            if (files.testFile) formData.append('testCsv', files.testFile);

            if (isNew) {
                if (!files.trainFile || !files.testFile) {
                    throw new Error('Vui lòng tải lên đủ file Train và Test cho bài toán mới.');
                }
                await api.post('/problems', formData);
                showToast('Tạo bài toán mới thành công!', 'success');
            } else if (editingProblem) {
                if (currentUser.role !== 'owner' && editingProblem.authorId !== currentUser.id) {
                    throw new Error('Bạn không có quyền chỉnh sửa bài toán này.');
                }
                await api.put(`/problems/${editingProblem.id}`, formData);
                showToast('Cập nhật bài toán thành công!', 'success');
            }

            await fetchAllData();
            setEditingProblem(null);
            navigate('problems');
        } catch (e: any) {
            const msg = e?.message || 'Có lỗi xảy ra khi lưu bài toán.';
            setPageError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setEditingProblem(null);
        navigate('problems');
        setError("");
        setPageError("");
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 mb-8 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleCancel}
                            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full transition-colors"
                            title="Quay lại"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-lg font-bold text-slate-800">
                            {isNew ? "Tạo cuộc thi mới" : `Chỉnh sửa: ${editingProblem.name}`}
                        </h1>
                    </div>
                    <div className="text-sm text-slate-500">
                         {isNew ? 'Bản nháp' : 'Đang chỉnh sửa'}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {pageError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-fade-in">
                        <div className="mt-0.5 font-bold text-red-800">Lỗi:</div>
                        <div>{pageError}</div>
                    </div>
                )}

                <ProblemEditorForm
                    initialProblem={editingProblem}
                    onSave={handleSaveProblem}
                    onCancel={handleCancel}
                    allTags={allTags}
                    allMetrics={allMetrics}
                    loading={loading}
                />
            </div>
        </div>
    );
};