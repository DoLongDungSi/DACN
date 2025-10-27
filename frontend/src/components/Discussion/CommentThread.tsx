import React from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowUp, ArrowDown, Edit3, Trash2 } from 'lucide-react'; // Added Edit3, Trash2
import { DiscussionComment, User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { CommentForm } from './CommentForm';
import { useAppContext } from '../../hooks/useAppContext';

interface CommentThreadProps {
    comment: DiscussionComment;
    allComments: DiscussionComment[];
    // Removed replyingTo, setReplyingTo - handled by editingItemId/Type
    handleVote: (targetType: "comments", targetId: number, voteType: "up" | "down") => void;
    handleCommentSubmit: (postId: number, content: string, parentId: number | null) => Promise<void> | void; // For replies
    // Removed currentUser prop, get from context
    depth?: number;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
    comment,
    allComments,
    handleVote,
    handleCommentSubmit, // Renamed from handleCommentSubmit to avoid conflict with update
    depth = 0
}) => {
    const { currentUser, navigateToProfile, editingItemId, setEditingItemId, editingItemType, setEditingItemType, handleUpdateComment, handleDeleteComment, replyingTo, setReplyingTo } = useAppContext(); // Get editing state and handlers

    const isEditing = editingItemType === 'comment' && editingItemId === comment.id;
    const isReplying = replyingTo === comment.id;

    const replies = allComments.filter(c => c.parentId === comment.id)
                              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const voteCount = (comment.upvotedBy?.length || 0) - (comment.downvotedBy?.length || 0);
    const userVote = comment.upvotedBy?.includes(currentUser?.id ?? -1) ? 'up' : comment.downvotedBy?.includes(currentUser?.id ?? -1) ? 'down' : null;
    const canEditDelete = currentUser && (currentUser.id === comment.userId || currentUser.role === 'owner');
    const marginLeft = depth > 0 ? `${depth * 1.5}rem` : '0';

    const handleUsernameClick = () => {
        if (comment.userId) navigateToProfile(comment.userId);
        else console.warn("Cannot navigate: userId is missing from comment object.");
    };

    const handleEditClick = () => {
        setEditingItemId(comment.id);
        setEditingItemType('comment');
        setReplyingTo(null); // Ensure not replying when editing
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingItemType(null);
    };

    // Handler for submitting an edited comment
    const handleEditSubmit = async (postIdIgnored: number, content: string, parentIdIgnored: number | null) => {
        await handleUpdateComment(comment.id, content);
        // Context handler should reset editing state
    };


    return (
        <div style={{ marginLeft }} className="comment-thread space-y-1">
            <div className="flex space-x-3">
                <button onClick={handleUsernameClick} className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 rounded-full mt-1">
                    <UserAvatar user={comment} size="w-8 h-8" textClass="text-sm" />
                </button>
                <div className="flex-grow">
                    {isEditing ? (
                        // Render CommentForm in edit mode
                        <CommentForm
                            postId={comment.postId} // Needed by form, ignored by handler
                            initialContent={comment.content}
                            isEditing={true}
                            onSubmit={handleEditSubmit} // Use the specific edit submit handler
                            onCancelEdit={handleCancelEdit} // Pass cancel handler
                            currentUser={currentUser}
                        />
                    ) : (
                        // Render normal comment view
                        <>
                             <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <div className="flex items-center space-x-2">
                                        <button onClick={handleUsernameClick} className="font-semibold text-slate-700 hover:text-indigo-600 hover:underline focus:outline-none"> {comment.username} </button>
                                        <span>•</span>
                                        <span>{comment.createdAt ? formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true }) : 'unknown time'}</span>
                                    </div>
                                     {/* Edit/Delete Buttons */}
                                     {canEditDelete && (
                                         <div className="flex items-center space-x-1">
                                            <button onClick={handleEditClick} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Sửa bình luận"> <Edit3 className="w-3.5 h-3.5" /> </button>
                                            <button onClick={() => handleDeleteComment(comment.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Xóa bình luận"> <Trash2 className="w-3.5 h-3.5" /> </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{comment.content}</p> {/* Use pre-wrap for line breaks */}
                            </div>
                            {/* Actions (Vote, Reply) - Only show if not editing */}
                            <div className="flex items-center space-x-4 mt-1 pl-1 text-xs">
                                <div className="flex items-center space-x-1 text-slate-500">
                                    <button onClick={() => handleVote("comments", comment.id, "up")} disabled={!currentUser} className={`p-1 rounded ${userVote === 'up' ? 'text-indigo-600 bg-indigo-100' : 'hover:bg-slate-100 disabled:text-slate-300'}`} aria-label="Upvote" title="Upvote"> <ArrowUp className="w-3.5 h-3.5" /> </button>
                                    <span className={`font-semibold w-4 text-center ${voteCount > 0 ? 'text-indigo-600' : voteCount < 0 ? 'text-red-600' : ''}`}> {voteCount} </span>
                                    <button onClick={() => handleVote("comments", comment.id, "down")} disabled={!currentUser} className={`p-1 rounded ${userVote === 'down' ? 'text-red-600 bg-red-100' : 'hover:bg-slate-100 disabled:text-slate-300'}`} aria-label="Downvote" title="Downvote"> <ArrowDown className="w-3.5 h-3.5" /> </button>
                                </div>
                                <button
                                    onClick={() => { setReplyingTo(isReplying ? null : comment.id); setEditingItemId(null); setEditingItemType(null); }} // Cancel edit if starting reply
                                    disabled={!currentUser}
                                    className={`font-semibold ${isReplying ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'} disabled:text-slate-300 disabled:cursor-not-allowed`}
                                > {isReplying ? 'Hủy' : 'Trả lời'} </button>
                            </div>
                        </>
                    )}

                    {/* Reply Form (only show if replying, not editing) */}
                    {isReplying && !isEditing && (
                        <div className="mt-2">
                            <CommentForm
                                postId={comment.postId}
                                parentId={comment.id}
                                onSubmit={handleCommentSubmit} // Use the standard submit handler for replies
                                isReply
                                currentUser={currentUser}
                                onCancelReply={() => setReplyingTo(null)}
                            />
                        </div>
                    )}
                 </div>
            </div>
             {replies.length > 0 && (
                 <div className="mt-4 space-y-4 comment-replies">
                     {replies.map((reply) => (
                         <CommentThread
                             key={reply.id}
                             comment={reply}
                             allComments={allComments}
                             handleVote={handleVote}
                             handleCommentSubmit={handleCommentSubmit} // Pass down reply handler
                             depth={depth + 1}
                         />
                     ))}
                 </div>
             )}
        </div>
    );
};
