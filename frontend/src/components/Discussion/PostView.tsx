import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Edit3, Trash2, X, Save, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { DiscussionPost } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { useAppContext } from '../../hooks/useAppContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';

interface PostViewProps {
    post: DiscussionPost | null;
    handleVote: (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => void;
}

const safeFormatDistanceToNow = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try { 
        const date = parseISO(dateString); 
        if (isValid(date)) return formatDistanceToNow(date, { addSuffix: true }); 
        return ''; 
    } catch (e) { return ''; }
};

export const PostView: React.FC<PostViewProps> = ({ post, handleVote }) => {
    const { 
        currentUser, navigateToProfile, 
        editingItemId, setEditingItemId, editingItemType, setEditingItemType, 
        handleUpdatePost, handleDeletePost, loading, votingKey 
    } = useAppContext();

    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');

    const isEditing = editingItemType === 'post' && editingItemId === post?.id;

    const handleEditClick = () => {
        if (!post) return;
        setEditTitle(post.title);
        setEditContent(post.content);
        setEditingItemId(post.id);
        setEditingItemType('post');
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingItemType(null);
    };

    const handleSaveEdit = async () => {
        if (!post || !editTitle.trim() || !editContent.trim()) return;
        await handleUpdatePost(post.id, editTitle.trim(), editContent.trim());
    };

    if (!post) return null;

    const canEditDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'owner');
    const voteCount = (post.upvotedBy?.length || 0) - (post.downvotedBy?.length || 0);
    const userVote = post.upvotedBy?.includes(currentUser?.id ?? -1) ? 'up' : post.downvotedBy?.includes(currentUser?.id ?? -1) ? 'down' : null;
    const isVoting = votingKey === `posts-${post.id}`;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
            <div className="flex items-start gap-6">
                
                {/* --- Left Column: Voting --- */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                    <button
                        onClick={() => handleVote('posts', post.id, 'up')}
                        disabled={!currentUser || loading || isVoting}
                        className={`p-2 rounded-xl transition-all ${userVote === 'up' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                        title="Upvote"
                    >
                        <ArrowUp className="w-6 h-6" strokeWidth={userVote === 'up' ? 3 : 2} />
                    </button>
                    
                    <span className={`font-bold text-lg py-1 ${voteCount > 0 ? 'text-indigo-600' : voteCount < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {voteCount}
                    </span>
                    
                    <button
                        onClick={() => handleVote('posts', post.id, 'down')}
                        disabled={!currentUser || loading || isVoting}
                        className={`p-2 rounded-xl transition-all ${userVote === 'down' ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:bg-slate-100 hover:text-rose-600'}`}
                        title="Downvote"
                    >
                        <ArrowDown className="w-6 h-6" strokeWidth={userVote === 'down' ? 3 : 2} />
                    </button>
                </div>

                {/* --- Right Column: Content --- */}
                <div className="flex-1 min-w-0">
                    
                    {/* Meta Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div 
                                onClick={() => post.userId && navigateToProfile(post.userId)} 
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <UserAvatar 
                                    user={{ username: post.username, avatarColor: post.avatarColor, avatarUrl: post.avatarUrl }} 
                                    size="md" 
                                    className="ring-2 ring-white shadow-sm"
                                />
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span 
                                        onClick={() => post.userId && navigateToProfile(post.userId)}
                                        className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-base"
                                    >
                                        {post.username || 'Ẩn danh'}
                                    </span>
                                    {post.userId === currentUser?.id && (
                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">You</span>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500 font-medium">{safeFormatDistanceToNow(post.createdAt)}</span>
                            </div>
                        </div>

                        {/* Edit Actions */}
                        {canEditDelete && !isEditing && (
                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                <button onClick={handleEditClick} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeletePost(post.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content Body */}
                    {isEditing ? (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full px-4 py-3 border border-indigo-200 rounded-xl font-bold text-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Tiêu đề bài viết..."
                                disabled={loading}
                            />
                            <div className="relative">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full px-4 py-3 border border-indigo-200 rounded-xl min-h-[200px] text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-mono resize-y"
                                    placeholder="Nội dung (Markdown supported)..."
                                    disabled={loading}
                                />
                                <div className="absolute bottom-3 right-3 flex gap-2">
                                    <button onClick={handleCancelEdit} disabled={loading} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors">
                                        Hủy
                                    </button>
                                    <button onClick={handleSaveEdit} disabled={loading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                                        {loading ? <LoadingSpinner size="xs" color="white"/> : <><Save className="w-3 h-3"/> Lưu</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-900 mb-4 leading-snug">
                                {post.title}
                            </h2>
                            <article className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-indigo-600 prose-img:rounded-xl prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-pre:rounded-xl">
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm, remarkMath]} 
                                    rehypePlugins={[rehypeKatex]}
                                >
                                    {post.content || ''}
                                </ReactMarkdown>
                            </article>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};