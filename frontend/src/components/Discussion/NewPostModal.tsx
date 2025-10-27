import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../../hooks/useAppContext'; // To get loading state
import { LoadingSpinner } from '../Common/LoadingSpinner';


interface NewPostModalProps {
    onClose: () => void;
    onSubmit: (title: string, content: string) => Promise<void> | void; // Allow async or sync
}

export const NewPostModal: React.FC<NewPostModalProps> = ({ onClose, onSubmit }) => {
    const { loading, setLoading, setError } = useAppContext(); // Get loading state from context
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [localError, setLocalError] = useState(""); // Local error for the modal

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        const trimmedContent = content.trim();

        if (!trimmedTitle || !trimmedContent) {
            setLocalError("Tiêu đề và nội dung không được để trống.");
            return;
        }
        setLocalError("");
        setError(""); // Clear global error
        setLoading(true); // Use global loading

        try {
            await onSubmit(trimmedTitle, trimmedContent);
             // onClose should be called by the onSubmit handler in the context/page on success
        } catch (err: any) {
            // Error is likely set in the onSubmit handler (context)
            console.error("Post submission failed in modal:", err);
             setLocalError(err.message || "Tạo bài viết thất bại.");
            setLoading(false); // Ensure loading is turned off on error here
        }
        // setLoading(false) should ideally be handled in the context's handler
        // But adding it here as a safety measure if the handler doesn't
        // setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl relative shadow-xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-700"
                    aria-label="Đóng"
                >
                    <X size={24} />
                </button>
                <h2 className="text-xl font-bold mb-4 text-slate-800">Tạo bài viết thảo luận mới</h2>

                 {localError && <p className="text-red-600 text-sm mb-4">{localError}</p>}

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="postTitle" className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề</label>
                            <input
                                id="postTitle"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Nhập tiêu đề..."
                                required
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label htmlFor="postContent" className="block text-sm font-medium text-slate-700 mb-1">Nội dung</label>
                            <textarea
                                id="postContent"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Viết nội dung của bạn ở đây..."
                                rows={10}
                                required
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                disabled={loading}
                            />
                             {/* Optional: Add markdown hint */}
                             <p className="text-xs text-slate-400 mt-1">Bạn có thể sử dụng Markdown cơ bản.</p>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 space-x-3">
                        <button
                            type="button" // Important: prevent form submission
                            onClick={onClose}
                            disabled={loading}
                            className="bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !title.trim() || !content.trim()}
                            className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed min-w-[100px] flex justify-center items-center"
                        >
                             {loading ? <LoadingSpinner/> : 'Đăng bài'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
