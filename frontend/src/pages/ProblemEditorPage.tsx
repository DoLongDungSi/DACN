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
        fetchAllData, // To refresh data after save
        setError,
        showToast, // Use showToast for feedback
        navigate,
    } = useAppContext();

    const isNew = editingProblem === "new";
    const [pageError, setPageError] = useState(''); // Local error state for the editor page

    // Authorization check
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'creator')) {
        return <div className="p-8 text-center text-red-600">Bạn không có quyền tạo hoặc chỉnh sửa bài toán.</div>;
    }
    if (!editingProblem) {
         return <div className="p-8 text-center text-slate-500">Không có bài toán nào đang được chỉnh sửa.</div>;
     }

    // Fetch full detail (including evaluation_script) when missing to restore script content
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
                console.error("Không lấy được chi tiết bài toán để khôi phục script:", e);
            }
        };
        fetchDetailIfNeeded();
    }, [editingProblem, api, setEditingProblem]);


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
        // giữ lại datasets khi update
        existingDatasets: (!isNew && editingProblem?.datasets) ? editingProblem.datasets : [],
        };

        // Ground truth bắt buộc khi tạo mới
        if (files.groundTruthFile) {
        formData.append('groundTruthCsv', files.groundTruthFile, files.groundTruthFile.name);
        } else if (isNew) {
        throw new Error('Vui lòng chọn file Ground Truth (.csv)');
        }

        formData.append('problemData', JSON.stringify(dataToSend));
        if (files.trainFile) formData.append('trainCsv', files.trainFile);
        if (files.testFile)  formData.append('testCsv',  files.testFile);

        if (isNew) {
        if (!files.trainFile || !files.testFile) {
            throw new Error('Vui lòng tải lên cả file train và test cho bài toán mới.');
        }
        await api.post('/problems', formData);
        showToast('Tạo bài toán thành công!', 'success');
        } else if (editingProblem) {
        if (currentUser.role !== 'owner' && editingProblem.authorId !== currentUser.id) {
            throw new Error('Bạn không được phép chỉnh sửa bài toán này.');
        }
        await api.put(`/problems/${editingProblem.id}`, formData);
        showToast('Cập nhật bài toán thành công!', 'success');
        }

        await fetchAllData();
        setEditingProblem(null);
        navigate('problems');
    } catch (e: any) {
        const msg = e?.message || 'Lưu bài toán thất bại';
        setPageError(msg);
        setError(msg);
        showToast(msg, 'error');
    } finally {
        setLoading(false);
    }
    };


    const handleCancel = () => {
         setEditingProblem(null);
         navigate('problems');
         setError(""); // Clear potential errors when cancelling
         setPageError("");
     }

    return (
        // Added gradient background similar to the target UI
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <button
                    onClick={handleCancel}
                    className="flex items-center text-indigo-600 font-semibold mb-6 group text-sm hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 rounded"
                >
                    <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Quay lại danh sách bài toán
                </button>

                 <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-gray-900">
                    {isNew ? "Tạo bài toán mới" : "Chỉnh sửa bài toán"}
                 </h1>
                 <p className="text-gray-600 mb-8">Thiết kế cuộc thi học máy của bạn.</p>

                 {pageError && <div className="mb-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg shadow-sm">{pageError}</div>}

                <ProblemEditorForm
                     initialProblem={editingProblem} // Pass the initial data
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
