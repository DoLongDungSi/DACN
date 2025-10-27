import React from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { DiscussionComment, User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { CommentForm } from './CommentForm';
import { useAppContext } from '../../hooks/useAppContext'; // Import context hook

interface CommentThreadProps {
    comment: DiscussionComment;
    allComments: DiscussionComment[];
    replyingTo: number | null;
    setReplyingTo: (id: number | null) => void;
    handleVote: (targetType: "comments", targetId: number, voteType: "up" | "down") => void;
    handleCommentSubmit: (postId: number, content: string, parentId: number | null) => Promise<void> | void;
    currentUser: User | null;
    depth?: number;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
    comment,
    allComments,
    replyingTo,
    setReplyingTo,
    handleVote,
    handleCommentSubmit,
    currentUser,
    depth = 0
}) => {
    // FIX: Get navigateToProfile function from context
    const { navigateToProfile } = useAppContext();

    const replies = allComments.filter(c => c.parentId === comment.id)
                              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const voteCount = (comment.upvotedBy?.length || 0) - (comment.downvotedBy?.length || 0);
    const userVote = comment.upvotedBy?.includes(currentUser?.id ?? -1)
        ? 'up'
        : comment.downvotedBy?.includes(currentUser?.id ?? -1)
        ? 'down'
        : null;

    const isReplying = replyingTo === comment.id;
    const marginLeft = depth > 0 ? `${depth * 1.5}rem` : '0';

    // Handler to navigate when username is clicked
    const handleUsernameClick = () => {
        // We have comment.userId, pass it to the navigation function
        if (comment.userId) {
             navigateToProfile(comment.userId); // Use userId directly
         } else {
             console.warn("Cannot navigate: userId is missing from comment object.");
             // Optionally show an error or do nothing
         }
    };


    return (
        <div style={{ marginLeft }} className="comment-thread">
            <div className="flex space-x-3">
                {/* FIX: Make avatar clickable */}
                <button onClick={handleUsernameClick} className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 rounded-full">
                    <UserAvatar user={comment} size="w-8 h-8" textClass="text-sm" />
                </button>
                <div className="flex-grow">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
                             {/* FIX: Make username clickable */}
                             <button
                                onClick={handleUsernameClick}
                                className="font-semibold text-slate-700 hover:text-indigo-600 hover:underline focus:outline-none"
                            >
                                {comment.username}
                            </button>
                            <span>•</span>
                            <span>{comment.createdAt ? formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true }) : 'unknown time'}</span>
                        </div>
                        <p className="text-sm text-slate-800">{comment.content}</p>
                    </div>
                    <div className="flex items-center space-x-4 mt-1 pl-1 text-xs">
                        <div className="flex items-center space-x-1 text-slate-500">
                             <button
                                onClick={() => handleVote("comments", comment.id, "up")}
                                disabled={!currentUser}
                                className={`p-1 rounded ${userVote === 'up' ? 'text-indigo-600 bg-indigo-100' : 'hover:bg-slate-100 disabled:text-slate-300'}`}
                                aria-label="Upvote comment"
                                title="Upvote"
                             >
                                <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <span className={`font-semibold w-4 text-center ${voteCount > 0 ? 'text-indigo-600' : voteCount < 0 ? 'text-red-600' : ''}`}>
                                {voteCount}
                            </span>
                             <button
                                onClick={() => handleVote("comments", comment.id, "down")}
                                disabled={!currentUser}
                                className={`p-1 rounded ${userVote === 'down' ? 'text-red-600 bg-red-100' : 'hover:bg-slate-100 disabled:text-slate-300'}`}
                                aria-label="Downvote comment"
                                title="Downvote"
                            >
                                <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                        </div>
                         <button
                            onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                            disabled={!currentUser}
                            className={`font-semibold ${isReplying ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'} disabled:text-slate-300 disabled:cursor-not-allowed`}
                         >
                            {isReplying ? 'Hủy' : 'Trả lời'}
                        </button>
                    </div>
                    {isReplying && (
                        <div className="mt-2">
                            <CommentForm
                                postId={comment.postId}
                                parentId={comment.id}
                                onSubmit={handleCommentSubmit}
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
                             replyingTo={replyingTo}
                             setReplyingTo={setReplyingTo}
                             handleVote={handleVote}
                             handleCommentSubmit={handleCommentSubmit}
                             currentUser={currentUser}
                             depth={depth + 1}
                         />
                     ))}
                 </div>
             )}
        </div>
    );
};

