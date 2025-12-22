import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowUp, ArrowDown, Edit3, Trash2, AlertTriangle } from 'lucide-react';
import type { DiscussionComment } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { CommentForm } from './CommentForm';
import { useAppContext } from '../../hooks/useAppContext';
import { api } from '../../api';
import { LoadingSpinner } from '../Common/LoadingSpinner';

interface CommentThreadProps {
    comment: DiscussionComment;
    allComments: DiscussionComment[];
    handleVote: (targetType: "comments", targetId: number, voteType: "up" | "down") => void;
    handleCommentSubmit: (postId: number, content: string, parentId: number | null) => Promise<void> | void;
    depth?: number;
}

// Modal xóa cục bộ cho Comment
const DeleteCommentModal = ({ isOpen, onClose, onConfirm, isDeleting }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; isDeleting: boolean }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 transform transition-all scale-100">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Xóa bình luận này?</h3>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} disabled={isDeleting} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Hủy</button>
                    <button onClick={onConfirm} disabled={isDeleting} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-md">
                        {isDeleting ? <LoadingSpinner size="xs" color="white"/> : <Trash2 className="w-3 h-3"/>}
                        {isDeleting ? '...' : 'Xóa'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const CommentThread: React.FC<CommentThreadProps> = ({
    comment,
    allComments,
    handleVote,
    handleCommentSubmit,
    depth = 0
}) => {
    const { 
        currentUser, navigateToProfile, 
        editingItemId, setEditingItemId, editingItemType, setEditingItemType, 
        handleUpdateComment, replyingTo, setReplyingTo, votingKey,
        showToast, setComments // Lấy setComments để update UI
    } = useAppContext();

    // State Modal xóa
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const isEditing = editingItemType === 'comment' && editingItemId === comment.id;
    const isReplying = replyingTo === comment.id;

    const replies = allComments.filter(c => c.parentId === comment.id)
                              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const voteCount = (comment.upvotedBy?.length || 0) - (comment.downvotedBy?.length || 0);
    const userVote = comment.upvotedBy?.includes(currentUser?.id ?? -1) ? 'up' : comment.downvotedBy?.includes(currentUser?.id ?? -1) ? 'down' : null;
    const canEditDelete = currentUser && (currentUser.id === comment.userId || currentUser.role === 'owner');
    const marginLeft = depth > 0 ? `${depth * 1.5}rem` : '0';
    const isVoting = votingKey === `comments-${comment.id}` || votingKey === `comment-${comment.id}`;

    const handleUsernameClick = () => {
        if (comment.userId) navigateToProfile(comment.userId);
    };

    const handleEditClick = () => {
        setEditingItemId(comment.id);
        setEditingItemType('comment');
        setReplyingTo(null);
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingItemType(null);
    };

    const handleEditSubmit = async (postIdIgnored: number, content: string, parentIdIgnored: number | null) => {
        await handleUpdateComment(comment.id, content);
    };

    // Hàm xóa thực thi
    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.delete(`/discussion/comments/${comment.id}`);
            
            // Xử lý UI: Xóa comment hiện tại và các con của nó
            const getRepliesRecursive = (id: number, all: DiscussionComment[]): number[] => {
                const directChildren = all.filter(c => c.parentId === id).map(c => c.id);
                return directChildren.reduce<number[]>((acc, childId) => {
                    return acc.concat([childId, ...getRepliesRecursive(childId, all)]);
                }, []);
            };
            const repliesToDelete = getRepliesRecursive(comment.id, allComments);
            setComments(prev => prev.filter(c => c.id !== comment.id && !repliesToDelete.includes(c.id)));
            
            showToast("Đã xóa bình luận.", "success");
        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Lỗi khi xóa bình luận.", "error");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <>
            <DeleteCommentModal 
                isOpen={showDeleteModal} 
                onClose={() => setShowDeleteModal(false)} 
                onConfirm={confirmDelete} 
                isDeleting={isDeleting} 
            />

            <div style={{ marginLeft }} className="comment-thread space-y-1">
                <div className="flex space-x-3">
                    <button onClick={handleUsernameClick} className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 rounded-full mt-1">
                        <UserAvatar user={comment} size="w-8 h-8" textClass="text-sm" />
                    </button>
                    <div className="flex-grow">
                        {isEditing ? (
                            <CommentForm
                                postId={comment.postId}
                                initialContent={comment.content}
                                isEditing={true}
                                onSubmit={handleEditSubmit}
                                onCancelEdit={handleCancelEdit}
                                currentUser={currentUser}
                            />
                        ) : (
                            <>
                                <div className="bg-white/80 border border-slate-200 rounded-lg p-3 shadow-sm">
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                        <div className="flex items-center space-x-2">
                                            <button onClick={handleUsernameClick} className="font-semibold text-slate-700 hover:text-indigo-600 hover:underline focus:outline-none"> {comment.username} </button>
                                            <span>•</span>
                                            <span>{comment.createdAt ? formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true }) : 'unknown time'}</span>
                                        </div>
                                         {canEditDelete && (
                                             <div className="flex items-center space-x-1">
                                                <button onClick={handleEditClick} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Sửa bình luận"> <Edit3 className="w-3.5 h-3.5" /> </button>
                                                <button onClick={() => setShowDeleteModal(true)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Xóa bình luận"> <Trash2 className="w-3.5 h-3.5" /> </button>
                                            </div>
                                        )}
                                    </div>
                                    <article className="prose prose-sm max-w-none prose-slate prose-a:text-indigo-600 hover:prose-a:text-indigo-800 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-700 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-md prose-pre:p-3">
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{comment.content || '*Không có nội dung*'}</ReactMarkdown>
                                    </article>
                                </div>
                                <div className="flex items-center space-x-4 mt-1 pl-1 text-xs">
                                    <div className="flex items-center space-x-1 text-slate-500">
                                        <button onClick={() => handleVote("comments", comment.id, "up")} disabled={!currentUser || isVoting} className={`p-1 rounded ${userVote === 'up' ? 'text-indigo-600 bg-indigo-100' : 'hover:bg-slate-100 disabled:text-slate-300'}`} aria-label="Upvote" title="Upvote"> <ArrowUp className="w-3.5 h-3.5" /> </button>
                                        <span className={`font-semibold w-4 text-center ${voteCount > 0 ? 'text-indigo-600' : voteCount < 0 ? 'text-red-600' : ''}`}> {voteCount} </span>
                                        <button onClick={() => handleVote("comments", comment.id, "down")} disabled={!currentUser || isVoting} className={`p-1 rounded ${userVote === 'down' ? 'text-red-600 bg-red-100' : 'hover:bg-slate-100 disabled:text-slate-300'}`} aria-label="Downvote" title="Downvote"> <ArrowDown className="w-3.5 h-3.5" /> </button>
                                    </div>
                                    <button onClick={() => { setReplyingTo(isReplying ? null : comment.id); setEditingItemId(null); setEditingItemType(null); }} disabled={!currentUser} className={`font-semibold ${isReplying ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'} disabled:text-slate-300 disabled:cursor-not-allowed`}> {isReplying ? 'Hủy' : 'Trả lời'} </button>
                                </div>
                            </>
                        )}

                        {isReplying && !isEditing && (
                            <div className="mt-2">
                                <CommentForm postId={comment.postId} parentId={comment.id} onSubmit={handleCommentSubmit} isReply currentUser={currentUser} onCancelReply={() => setReplyingTo(null)} />
                            </div>
                        )}
                     </div>
                </div>
                 {replies.length > 0 && (
                     <div className="mt-4 space-y-4 comment-replies">
                         {replies.map((reply) => (
                             <CommentThread key={reply.id} comment={reply} allComments={allComments} handleVote={handleVote} handleCommentSubmit={handleCommentSubmit} depth={depth + 1} />
                         ))}
                     </div>
                 )}
            </div>
        </>
    );
};