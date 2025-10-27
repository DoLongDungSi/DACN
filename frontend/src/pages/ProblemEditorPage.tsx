import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { ProblemEditorForm } from '../components/Problem/ProblemEditorForm';
import { Problem } from '../types';
import { api } from '../api';

export const ProblemEditorPage: React.FC = () => {
    const {
        editingProblem,
        setEditingProblem,
        setPage,
        allTags,
        allMetrics,
        loading,
        setLoading,
        currentUser,
        fetchAllData, // To refresh data after save
        setError,
        showToast, // Use showToast for feedback
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


     const handleSaveProblem = async (
        problemData: Partial<Problem>,
        tagIds: number[],
        metricIds: number[],
        files: { trainFile: File | null; testFile: File | null }
    ) => {
        if (!currentUser) return;

        setLoading(true);
        setError(""); // Clear global error
        setPageError(""); // Clear local error

        try {
            const formData = new FormData();

            // Prepare data, including existing datasets if updating
            const dataToSend = {
                ...problemData,
                tagIds,
                metricIds,
                // Include existing datasets only if it's an update and they exist
                 existingDatasets: (!isNew && editingProblem?.datasets) ? editingProblem.datasets : [],
            };
            formData.append("problemData", JSON.stringify(dataToSend));
            // Append files if they exist
            if (files.trainFile) formData.append('trainCsv', files.trainFile); // Key matches backend middleware
            if (files.testFile) formData.append('testCsv', files.testFile); // Key matches backend middleware


            if (isNew) {
                // Creating a new problem
                 // **Validation:** Ensure files are present for new problems
                if (!files.trainFile || !files.testFile) {
                    throw new Error("Vui lòng tải lên cả file train và test cho bài toán mới.");
                }
                await api.post("/problems", formData);
                showToast("Tạo bài toán thành công!", "success"); // Use toast
            } else if (editingProblem) {
                // Updating an existing problem
                 // Authorization check: Ensure creator is owner or original author
                 if (currentUser.role !== 'owner' && editingProblem.authorId !== currentUser.id) {
                     throw new Error("Bạn không được phép chỉnh sửa bài toán này.");
                 }
                await api.put(`/problems/${editingProblem.id}`, formData);
                 showToast("Cập nhật bài toán thành công!", "success"); // Use toast
            }

            await fetchAllData(); // Refresh data after successful save
            setEditingProblem(null); // Clear editing state
            setPage("problems"); // Navigate back to the list

        } catch (e: any) {
            console.error("Failed to save problem", e);
            const errorMsg = e.message || `Lưu bài toán thất bại. ${isNew ? 'Kiểm tra xem tên bài toán đã tồn tại chưa.' : ''}`;
            // Let the API helper show the toast for API errors
            // setError(errorMsg); // Set global error as well
            setPageError(errorMsg); // Show error specific to this page
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
         setEditingProblem(null);
         setPage("problems");
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
