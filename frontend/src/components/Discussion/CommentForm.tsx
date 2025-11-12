import React, { useState, useEffect } from 'react'; // Added useEffect
import type { User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { useAppContext } from '../../hooks/useAppContext';
import { LoadingSpinner } from '../Common/LoadingSpinner'; // Import LoadingSpinner
import { X, Save } from 'lucide-react'; // Import icons

interface CommentFormProps {
    postId: number;
    parentId?: number | null;
    onSubmit: (postId: number, content: string, parentId: number | null) => Promise<void> | void;
    isReply?: boolean;
    currentUser?: User | null;
    onCancelReply?: () => void;
    // Props for editing mode
    isEditing?: boolean;
    initialContent?: string;
    onCancelEdit?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({
    postId,
    parentId = null,
    onSubmit,
    isReply = false,
    currentUser: propCurrentUser,
    onCancelReply,
    isEditing = false,
    initialContent = "",
    onCancelEdit,
}) => {
    const contextCurrentUser = useAppContext().currentUser;
    const currentUser = propCurrentUser ?? contextCurrentUser;
    const { loading, setLoading, setError, showToast } = useAppContext(); // Get loading/error state & toast

    const [content, setContent] = useState(initialContent);
    const [isSubmitting, setIsSubmitting] = useState(false); // Local submitting state

    // Update content if initialContent changes (when edit starts)
    useEffect(() => {
        if (isEditing) {
            setContent(initialContent);
        }
    }, [isEditing, initialContent]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            showToast("Nội dung không được để trống.", "error"); // Use toast for validation
            return;
        }
        if (!currentUser) {
             showToast("Bạn cần đăng nhập để bình luận.", "error"); // Use toast
             return;
        }

        setIsSubmitting(true);
        setError(""); // Clear previous errors
        try {
            // onSubmit handles both create and update logic based on isEditing flag passed from parent
            await onSubmit(postId, trimmedContent, parentId);
            if (!isEditing) {
                setContent(""); // Clear content only on successful NEW submission
                 if (isReply && onCancelReply) {
                    onCancelReply(); // Close the reply form
                }
            }
             // Closing edit form is handled by parent via onCancelEdit/setting editing state in context
        } catch (err: any) {
            console.error("Comment submission/update failed:", err);
            // Error is handled by the API helper which shows a toast
        } finally {
            setIsSubmitting(false);
        }
    };

     const handleCancel = () => {
        if (isEditing && onCancelEdit) {
            onCancelEdit();
            setContent(initialContent); // Reset content on cancel edit
        } else if (isReply && onCancelReply) {
            onCancelReply();
            setContent(''); // Reset content on cancel reply
        }
    };

    if (!currentUser) {
        return <p className="text-sm text-slate-500 mt-2">Vui lòng <button onClick={() => { /* Need login navigation */ }} className="text-indigo-600 hover:underline">đăng nhập</button> để {isEditing ? 'sửa' : 'viết'} {isReply ? 'trả lời' : 'bình luận'}.</p>;
    }


    return (
        <form onSubmit={handleSubmit} className={`flex items-start space-x-3 ${isReply || isEditing ? 'mt-2' : ''}`}>
             {!isEditing && <UserAvatar user={currentUser} size="w-8 h-8" textClass="text-sm" />} {/* Hide avatar when editing */}
            <div className={`flex-grow ${isEditing ? 'w-full' : ''}`}> {/* Take full width when editing */}
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={isEditing ? "Chỉnh sửa bình luận..." : (isReply ? "Viết câu trả lời..." : "Viết bình luận của bạn...")}
                    rows={isEditing ? 4 : (isReply ? 2 : 3)} // More rows for editing
                    required
                    className={`w-full p-2 border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isSubmitting ? 'bg-slate-100 cursor-wait' : 'border-slate-300'}`}
                    disabled={isSubmitting}
                    aria-label={isEditing ? "Edit comment content" : (isReply ? "Reply content" : "Comment content")}
                    autoFocus={isEditing || isReply} // Autofocus when editing or replying
                />
                <div className="flex justify-end items-center mt-2 space-x-2">
                      {/* Show Cancel button for both reply and edit */}
                      {(isReply || isEditing) && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center" // Adjusted padding
                        >
                            <X className="w-3.5 h-3.5 mr-1"/> Hủy
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || !content.trim()}
                        className="text-sm bg-indigo-600 text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed min-w-[70px] flex items-center justify-center" // Adjusted padding & min-width
                    >
                         {isSubmitting ? <LoadingSpinner size="sm" /> : (isEditing ? <><Save className="w-3.5 h-3.5 mr-1"/> Lưu</> : 'Gửi')}
                    </button>
                </div>
            </div>
        </form>
    );
};
