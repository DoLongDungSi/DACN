import React, { useMemo, useCallback } from 'react'; // Added useCallback
import { PlusCircle, ArrowLeft, MessageSquare, ArrowUp } from 'lucide-react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns'; // Added isValid
import { useAppContext } from '../../hooks/useAppContext';
import type { DiscussionPost, DiscussionComment } from '../../types';
import { PostView } from './PostView';
import { CommentThread } from './CommentThread';
import { CommentForm } from './CommentForm';
import { NewPostModal } from './NewPostModal';
import { LoadingSpinner } from '../Common/LoadingSpinner';

interface DiscussionComponentProps {
    problemId: number;
}

// Helper function to safely parse and format date
const safeFormatDistanceToNow = (dateString: string | null | undefined): string => {
    if (!dateString) return 'không rõ thời gian';
    try {
        const date = parseISO(dateString);
        // Check if the parsed date is valid
        if (isValid(date)) {
            return formatDistanceToNow(date, { addSuffix: true });
        }
        return 'thời gian không hợp lệ';
    } catch (e) {
        console.error("Error parsing date:", dateString, e);
        return 'lỗi thời gian';
    }
};


export const DiscussionComponent: React.FC<DiscussionComponentProps> = ({ problemId }) => {
    const {
        posts, comments, currentUser, viewingPost, setViewingPost,
        showNewPostModal, setShowNewPostModal, handlePostSubmit,
        handleCommentSubmit, handleVote, replyingTo, setReplyingTo, loading
    } = useAppContext();

    const problemPosts = useMemo(() => {
        if (!Array.isArray(posts)) return [];
        return posts
            .filter((p): p is DiscussionPost => !!p && p.problemId === problemId && p.id !== undefined && p.id !== null) // Ensure post and id exist
            .sort((a, b) => {
                 const voteA = (a.upvotedBy?.length || 0) - (a.downvotedBy?.length || 0);
                 const voteB = (b.upvotedBy?.length || 0) - (b.downvotedBy?.length || 0);
                 // Safe date comparison
                 const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                 const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                 if (isNaN(dateA) || isNaN(dateB)) return 0; // Avoid sorting if dates are invalid
                 if (voteB !== voteA) return voteB - voteA;
                 return dateB - dateA; // Newest first for tie-breaker
             });
    }, [posts, problemId]);

    const postComments = useMemo(() => {
        if (!viewingPost || !Array.isArray(comments)) return [];
        return comments.filter((c): c is DiscussionComment =>
            !!c &&
            c.postId === viewingPost.id &&
            c.id !== undefined && c.id !== null // Ensure comment and id exist
        );
    }, [comments, viewingPost]);

    const getThreadComments = useCallback((parentId: number | null): DiscussionComment[] => {
        if (!Array.isArray(postComments)) return [];
        const directReplies = postComments.filter(c => c.parentId === parentId);
        let allReplies: DiscussionComment[] = [...directReplies];
        directReplies.forEach(reply => {
            if (reply && reply.id !== undefined && reply.id !== null) {
                allReplies = allReplies.concat(getThreadComments(reply.id));
            }
        });
        return allReplies;
    }, [postComments]);

    const totalCommentCount = useMemo(() => {
        // Calculate only if viewingPost is valid
        if (!viewingPost || typeof viewingPost !== 'object' || viewingPost.id === undefined || viewingPost.id === null) return 0;
        try {
            return getThreadComments(null).length;
        } catch (e) {
            console.error("Error calculating comment count:", e);
            return 0;
        }
     }, [viewingPost, getThreadComments]);


    return (
        <div>
            {showNewPostModal && (
                <NewPostModal
                    onClose={() => setShowNewPostModal(false)}
                    onSubmit={handlePostSubmit}
                />
            )}

            {!viewingPost ? (
                // --- List View ---
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">Thảo luận</h3>
                        {currentUser && (
                            <button onClick={() => setShowNewPostModal(true)} className="new-post-button">
                                <PlusCircle className="w-4 h-4 mr-2" /> Tạo bài viết
                            </button>
                        )}
                    </div>
                    <div className="space-y-4">
                        {loading && !posts?.length ? (
                             <div className="text-center p-8 text-slate-500 flex justify-center items-center"> <LoadingSpinner/> <span className="ml-2">Đang tải bài viết...</span></div>
                         ) : problemPosts.length > 0 ? (
                             problemPosts.map((post) => {
                                // Double check post validity before rendering list item
                                if (!post || post.id === undefined || post.id === null) return null;
                                const postCommentCount = Array.isArray(comments) ? comments.filter((c) => c?.postId === post.id).length : 0;
                                const voteCount = (post.upvotedBy?.length || 0) - (post.downvotedBy?.length || 0);
                                return (
                                    <button
                                        key={post.id}
                                        onClick={() => setViewingPost(post)}
                                        className="post-list-item"
                                        aria-label={`Xem bài viết ${post.title || 'không có tiêu đề'}`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <h4 className="post-title truncate flex-1">{post.title || <span className="italic text-slate-400">Không có tiêu đề</span>}</h4>
                                            <div className="post-meta flex-shrink-0">
                                                <div className="meta-item"> <MessageSquare className="w-4 h-4" /> <span>{postCommentCount}</span> </div>
                                                <div className="meta-item"> <ArrowUp className="w-4 h-4" /> <span>{voteCount}</span> </div>
                                            </div>
                                        </div>
                                        <p className="post-author-time">
                                            Đăng bởi {post.username || <span className="italic text-slate-400">Ẩn danh</span>} •{' '}
                                            {/* Use safe date formatter */}
                                            {safeFormatDistanceToNow(post.createdAt)}
                                        </p>
                                    </button>
                                );
                            })
                        ) : (
                             !loading && <p className="text-center text-slate-500 py-8"> Chưa có bài thảo luận nào. Hãy là người đầu tiên! </p>
                        )}
                    </div>
                </div>
            ) : (
                 // --- Detail View ---
                 <div>
                    <button onClick={() => setViewingPost(null)} className="back-button">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Quay lại danh sách thảo luận
                    </button>

                     {/* Render PostView safely */}
                     <PostView
                        post={viewingPost} // Pass viewingPost directly
                        currentUser={currentUser}
                        handleVote={(type, id, vote) => handleVote(type as 'posts', id, vote)}
                    />

                    {/* Comments section - render only if viewingPost is valid */}
                    {viewingPost && typeof viewingPost === 'object' && viewingPost.id !== undefined && viewingPost.id !== null && (
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="text-lg font-bold mb-4 text-slate-800">
                                {loading && !comments?.length ? 'Đang tải bình luận...' : `${totalCommentCount} Bình luận`}
                            </h3>
                            {currentUser && (
                                <CommentForm
                                    postId={viewingPost.id}
                                    onSubmit={handleCommentSubmit}
                                    currentUser={currentUser}
                                    isReply={false}
                                />
                            )}

                            <div className="mt-6 space-y-6">
                                {loading && !comments?.length && (
                                    <div className="text-center py-4 text-slate-500 flex justify-center items-center"><LoadingSpinner size="sm"/> <span className="ml-2">Đang tải...</span></div>
                                )}
                                 {/* Map comments safely */}
                                 {Array.isArray(postComments) && postComments
                                    .filter(c => c.parentId === null) // Only top-level
                                    .sort((a,b)=> {
                                        // Safe date comparison
                                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                        if (isNaN(dateA) || isNaN(dateB)) return 0;
                                        return dateA - dateB; // Oldest first
                                    })
                                    .map((comment) => (
                                         // Render CommentThread only if comment and id are valid
                                         comment && comment.id !== undefined && comment.id !== null ? (
                                            <CommentThread
                                                key={comment.id}
                                                comment={comment}
                                                allComments={postComments} // Pass only relevant comments
                                                replyingTo={replyingTo}
                                                setReplyingTo={setReplyingTo}
                                                handleVote={handleVote}
                                                handleCommentSubmit={handleCommentSubmit}
                                                currentUser={currentUser}
                                            />
                                         ) : null
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Styles */}
             <style>{`
                .new-post-button { background-color: #4f46e5; color: white; font-weight: 600; padding: 0.5rem 1rem; border-radius: 0.5rem; display: flex; align-items: center; font-size: 0.875rem; line-height: 1.25rem; } .new-post-button:hover { background-color: #4338ca; }
                .post-list-item { display: block; width: 100%; background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; text-align: left; transition: background-color 0.15s ease-in-out; } .post-list-item:hover { background-color: #f1f5f9; }
                .post-title { font-weight: 600; color: #4338ca; margin-bottom: 0.25rem; }
                .post-meta { display: flex; align-items: center; column-gap: 1rem; font-size: 0.875rem; line-height: 1.25rem; color: #64748b; }
                .meta-item { display: flex; align-items: center; column-gap: 0.25rem; }
                .post-author-time { font-size: 0.75rem; line-height: 1rem; color: #64748b; margin-top: 0.5rem; }
                .back-button { color: #4f46e5; font-weight: 600; margin-bottom: 1.5rem; display: flex; align-items: center; font-size: 0.875rem; line-height: 1.25rem; }
            `}</style>
        </div>
    );
};

