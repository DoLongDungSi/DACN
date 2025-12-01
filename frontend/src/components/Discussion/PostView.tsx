import React, { useState } from 'react'; // Added useState
import { ArrowUp, ArrowDown, Edit3, Trash2, X, Save } from 'lucide-react'; // Added Edit3, Trash2, X, Save
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import ReactMarkdown from 'react-markdown'; // For rendering content preview
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { DiscussionPost, User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { useAppContext } from '../../hooks/useAppContext';
import { LoadingSpinner } from '../Common/LoadingSpinner'; // Import LoadingSpinner

interface PostViewProps {
    post: DiscussionPost | null;
    // Removed currentUser prop, get from context
    handleVote: (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => void;
    // Added props for editing/deleting
    // handleUpdatePost: (postId: number, title: string, content: string) => Promise<void>;
    // handleDeletePost: (postId: number) => void;
}

// Helper function to safely parse and format date
const safeFormatDistanceToNow = (dateString: string | null | undefined): string => {
    if (!dateString) return 'không rõ thời gian';
    try { const date = parseISO(dateString); if (isValid(date)) return formatDistanceToNow(date, { addSuffix: true }); return 'thời gian không hợp lệ'; }
    catch (e) { console.error("Error parsing date:", dateString, e); return 'lỗi thời gian'; }
};

export const PostView: React.FC<PostViewProps> = ({ post, handleVote }) => {
    const { currentUser, navigateToProfile, editingItemId, setEditingItemId, editingItemType, setEditingItemType, handleUpdatePost, handleDeletePost, loading, votingKey } = useAppContext(); // Get editing state and handlers

    // Local state for editing form
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');

    const isEditing = editingItemType === 'post' && editingItemId === post?.id;

    // Start editing
    const handleEditClick = () => {
        if (!post) return;
        setEditTitle(post.title);
        setEditContent(post.content);
        setEditingItemId(post.id);
        setEditingItemType('post');
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingItemType(null);
    };

    // Save edit
    const handleSaveEdit = async () => {
        if (!post || !editTitle.trim() || !editContent.trim()) {
            alert("Tiêu đề và nội dung không được để trống."); // Simple validation
            return;
        }
        await handleUpdatePost(post.id, editTitle.trim(), editContent.trim());
        // Context handler should reset editing state on success
    };

    if (!post || typeof post !== 'object' || post.id === undefined || post.id === null) {
        return <p className="text-red-500 p-4">Lỗi: Dữ liệu bài viết không hợp lệ hoặc bị thiếu.</p>;
    }

    const canEditDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'owner');
    const voteCount = (post.upvotedBy?.length || 0) - (post.downvotedBy?.length || 0);
    const userVote = post.upvotedBy?.includes(currentUser?.id ?? -1) ? 'up' : post.downvotedBy?.includes(currentUser?.id ?? -1) ? 'down' : null;
    const createdAtString = safeFormatDistanceToNow(post.createdAt);

    const handleAuthorClick = () => {
        if (post?.userId !== undefined && post.userId !== null) navigateToProfile(post.userId);
        else console.error("Cannot navigate to profile, missing userId for post:", post.id);
    };

    const isVoting = votingKey === `posts-${post.id}` || votingKey === `post-${post.id}`;

    return (
        <div className="flex items-start space-x-4 p-1">
            {/* Voting Section */}
            <div className="flex flex-col items-center space-y-1 flex-shrink-0 pt-1">
                <button
                    onClick={() => handleVote('posts', post.id, 'up')}
                    disabled={!currentUser || loading || isVoting} // Disable voting while saving edit
                    className="vote-button"
                    aria-label="Upvote post"
                >
                    <ArrowUp className={`w-5 h-5 ${userVote === 'up' ? 'text-indigo-600 fill-indigo-200' : ''}`} strokeWidth={userVote === 'up' ? 2.5 : 2} />
                </button>
                <span className="font-bold text-lg text-slate-700 select-none w-8 text-center" aria-label={`Score: ${voteCount}`}> {voteCount} </span>
                <button
                    onClick={() => handleVote('posts', post.id, 'down')}
                    disabled={!currentUser || loading || isVoting} // Disable voting while saving edit
                    className="vote-button"
                    aria-label="Downvote post"
                >
                    <ArrowDown className={`w-5 h-5 ${userVote === 'down' ? 'text-red-600 fill-red-200' : ''}`} strokeWidth={userVote === 'down' ? 2.5 : 2} />
                </button>
            </div>

            {/* Post Content/Edit Section */}
            <div className="flex-grow min-w-0">
                {/* Author Info & Edit/Delete Buttons */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 text-sm text-slate-500">
                        <button onClick={handleAuthorClick} className="flex items-center space-x-2 group focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded" aria-label={`Xem hồ sơ của ${post.username || 'người dùng'}`}>
                            <UserAvatar user={{ username: post.username || '?', avatarColor: post.avatarColor || 'bg-slate-400', avatarUrl: post.avatarUrl }} size="w-6 h-6" textClass="text-xs" />
                            <span className="font-semibold text-slate-700 group-hover:text-indigo-600 group-hover:underline"> {post.username || <span className="italic">Ẩn danh</span>} </span>
                        </button>
                        <span>•</span>
                        <span>{createdAtString}</span>
                    </div>
                     {/* Edit/Delete Buttons */}
                     {canEditDelete && !isEditing && (
                         <div className="flex items-center space-x-2">
                            <button onClick={handleEditClick} className="edit-delete-button text-slate-500 hover:text-indigo-600" title="Sửa bài viết">
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeletePost(post.id)} className="edit-delete-button text-slate-500 hover:text-red-600" title="Xóa bài viết">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Title and Content or Edit Form */}
                {isEditing ? (
                    <div className="space-y-3 mt-1">
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Tiêu đề..."
                            required
                            className="w-full p-2 border border-slate-300 rounded-lg text-lg font-semibold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            disabled={loading}
                        />
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            placeholder="Nội dung (Markdown + LaTeX)..."
                            rows={8}
                            required
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                            disabled={loading}
                            spellCheck="false"
                        />
                        <div className="flex justify-end space-x-2">
                             <button onClick={handleCancelEdit} disabled={loading} className="cancel-button"> <X className="w-4 h-4 mr-1"/> Hủy </button>
                             <button onClick={handleSaveEdit} disabled={loading || !editTitle.trim() || !editContent.trim()} className="save-button"> {loading ? <LoadingSpinner size="sm"/> : <><Save className="w-4 h-4 mr-1"/> Lưu</>} </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-slate-900 mt-1 mb-4 break-words">
                            {post.title || <span className="italic text-slate-500">Không có tiêu đề</span>}
                        </h2>
                        <article className="prose prose-sm max-w-none prose-slate prose-headings:font-semibold prose-a:text-indigo-600 hover:prose-a:text-indigo-800 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:text-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-pre:bg-slate-800 prose-pre:text-slate-200 prose-pre:rounded-lg">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {post.content || '<p class="italic text-slate-500">Không có nội dung</p>'}
                            </ReactMarkdown>
                        </article>
                    </>
                )}
            </div>
             {/* Styles */}
             <style>{`
                .vote-button { padding: 0.25rem; border-radius: 9999px; color: #94a3b8; transition: color 150ms ease-in-out, background-color 150ms ease-in-out; }
                .vote-button:hover:not(:disabled) { background-color: #f1f5f9; }
                .vote-button:disabled { opacity: 0.5; cursor: not-allowed; }
                .vote-button:focus-visible { outline: 2px solid transparent; outline-offset: 2px; ring: 2px ring-indigo-500 ring-offset-1; }
                .edit-delete-button { padding: 0.25rem; border-radius: 0.375rem; transition: color 150ms ease-in-out, background-color 150ms ease-in-out; }
                .edit-delete-button:hover { background-color: #f1f5f9; }
                .cancel-button { font-size: 0.875rem; font-weight: 600; color: #475569; background-color: #e2e8f0; padding: 0.375rem 0.75rem; border-radius: 0.375rem; display: inline-flex; align-items: center; transition: background-color 150ms ease-in-out; }
                .cancel-button:hover:not(:disabled) { background-color: #cbd5e1; }
                .cancel-button:disabled { opacity: 0.6; }
                .save-button { font-size: 0.875rem; font-weight: 600; color: white; background-color: #4f46e5; padding: 0.375rem 0.75rem; border-radius: 0.375rem; display: inline-flex; align-items: center; transition: background-color 150ms ease-in-out; min-width: 60px; justify-content: center; }
                .save-button:hover:not(:disabled) { background-color: #4338ca; }
                .save-button:disabled { background-color: #a5b4fc; cursor: not-allowed; }
                 /* Prose adjustments for KaTeX */
                 .prose .katex-display { margin-left: 0; margin-right: 0; overflow-x: auto; }
            `}</style>
        </div>
    );
};
