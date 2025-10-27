import React, { useState } from 'react';
import { User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { useAppContext } from '../../hooks/useAppContext'; // To get currentUser if not passed

interface CommentFormProps {
    postId: number;
    parentId?: number | null;
    onSubmit: (postId: number, content: string, parentId: number | null) => Promise<void> | void; // Allow sync or async
    isReply?: boolean;
    // currentUser can be passed directly or fetched from context
    currentUser?: User | null;
    // Callback to close the reply form (optional, useful for nested replies)
    onCancelReply?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({
    postId,
    parentId = null,
    onSubmit,
    isReply = false,
    currentUser: propCurrentUser, // Rename prop to avoid conflict
    onCancelReply,
}) => {
    const contextCurrentUser = useAppContext().currentUser;
    const currentUser = propCurrentUser ?? contextCurrentUser; // Use prop or context
    const { loading, setLoading, setError } = useAppContext(); // Get loading/error state

    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false); // Local submitting state

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            // Optionally show a small validation message
            return;
        }
        if (!currentUser) {
             setError("Bạn cần đăng nhập để bình luận.");
             return;
        }

        setIsSubmitting(true);
        setError(""); // Clear previous errors
        try {
            await onSubmit(postId, trimmedContent, parentId);
            setContent(""); // Clear content on successful submission
            if (isReply && onCancelReply) {
                onCancelReply(); // Close the reply form if it's a reply and callback exists
            }
        } catch (err: any) {
            // Error should be handled by the onSubmit function (likely setting context error)
            console.error("Comment submission failed:", err);
            // Optionally set a local error state if needed
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) {
        // Optionally show a login prompt instead of the form
        return <p className="text-sm text-slate-500">Vui lòng <button className="text-indigo-600 hover:underline">đăng nhập</button> để bình luận.</p>;
    }


    return (
        <form onSubmit={handleSubmit} className={`flex items-start space-x-3 ${isReply ? 'mt-2' : ''}`}>
            <UserAvatar user={currentUser} size="w-8 h-8" textClass="text-sm" />
            <div className="flex-grow">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={isReply ? "Viết câu trả lời..." : "Viết bình luận của bạn..."}
                    rows={isReply ? 2 : 3}
                    required
                    className={`w-full p-2 border rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${isSubmitting ? 'bg-slate-100' : 'border-slate-300'}`}
                    disabled={isSubmitting}
                    aria-label={isReply ? "Reply content" : "Comment content"}
                />
                <div className="flex justify-end items-center mt-2 space-x-2">
                     {isReply && onCancelReply && (
                        <button
                            type="button" // Important: prevent form submission
                            onClick={onCancelReply}
                            disabled={isSubmitting}
                            className="text-xs font-semibold text-slate-500 px-3 py-1 rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || !content.trim()}
                        className="text-sm bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Đang gửi...' : 'Gửi'}
                    </button>
                </div>
            </div>
        </form>
    );
};
