import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Edit3, Trash2, X, Save, AlertTriangle } from 'lucide-react';
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
import { api } from '../../api';

interface PostViewProps {
    post: DiscussionPost | null;
    handleVote: (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => void;
}

// Modal xác nhận xóa riêng biệt (Local Modal)
const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, isDeleting }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; isDeleting: boolean }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all scale-100">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Xóa bài viết?</h3>
                        <p className="text-sm text-slate-500">Hành động này không thể hoàn tác. Bạn chắc chắn muốn tiếp tục?</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Hủy bỏ</button>
                    <button onClick={onConfirm} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-red-200">
                        {isDeleting ? <LoadingSpinner size="xs" color="white"/> : <Trash2 className="w-4 h-4"/>}
                        {isDeleting ? 'Đang xóa...' : 'Xóa ngay'}
                    </button>
                </div>
            </div>
        </div>
    );
};

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
        handleUpdatePost, loading, votingKey,
        showToast, setViewingPost, setPosts // Lấy setPosts để cập nhật UI ngay lập tức
    } = useAppContext();

    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    
    // State cho Modal xóa cục bộ
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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

    // Hàm thực thi xóa
    const confirmDelete = async () => {
        if (!post) return;
        setIsDeleting(true);
        try {
            await api.delete(`/discussion/posts/${post.id}`);
            
            // Cập nhật UI ngay lập tức
            setPosts(prev => prev.filter(p => p.id !== post.id));
            setViewingPost(null); // Quay về danh sách
            
            showToast('Đã xóa bài viết thành công', 'success');
        } catch (err: any) {
            console.error(err);
            showToast(err.message || "Lỗi khi xóa bài viết", "error");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    if (!post) return null;

    const canEditDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'owner' || currentUser.role === 'admin');
    const voteCount = (post.upvotedBy?.length || 0) - (post.downvotedBy?.length || 0);
    const userVote = post.upvotedBy?.includes(currentUser?.id ?? -1) ? 'up' : post.downvotedBy?.includes(currentUser?.id ?? -1) ? 'down' : null;
    const isVoting = votingKey === `posts-${post.id}`;

    return (
        <>
            <DeleteConfirmModal 
                isOpen={showDeleteModal} 
                onClose={() => setShowDeleteModal(false)} 
                onConfirm={confirmDelete} 
                isDeleting={isDeleting} 
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
                <div className="flex items-start gap-6">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                        <button onClick={() => handleVote('posts', post.id, 'up')} disabled={!currentUser || loading || isVoting} className={`p-2 rounded-xl transition-all ${userVote === 'up' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}>
                            <ArrowUp className="w-6 h-6" strokeWidth={userVote === 'up' ? 3 : 2} />
                        </button>
                        <span className={`font-bold text-lg py-1 ${voteCount > 0 ? 'text-indigo-600' : voteCount < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{voteCount}</span>
                        <button onClick={() => handleVote('posts', post.id, 'down')} disabled={!currentUser || loading || isVoting} className={`p-2 rounded-xl transition-all ${userVote === 'down' ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:bg-slate-100 hover:text-rose-600'}`}>
                            <ArrowDown className="w-6 h-6" strokeWidth={userVote === 'down' ? 3 : 2} />
                        </button>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div onClick={() => post.userId && navigateToProfile(post.userId)} className="cursor-pointer hover:opacity-80 transition-opacity">
                                    <UserAvatar user={{ username: post.username, avatarColor: post.avatarColor, avatarUrl: post.avatarUrl }} size="md" className="ring-2 ring-white shadow-sm"/>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span onClick={() => post.userId && navigateToProfile(post.userId)} className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-base">{post.username || 'Ẩn danh'}</span>
                                        {post.userId === currentUser?.id && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">You</span>}
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">{safeFormatDistanceToNow(post.createdAt)}</span>
                                </div>
                            </div>

                            {canEditDelete && !isEditing && (
                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                    <button onClick={handleEditClick} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all" title="Sửa bài"><Edit3 className="w-4 h-4" /></button>
                                    {/* Nút xóa mở Modal cục bộ */}
                                    <button onClick={() => setShowDeleteModal(true)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-all" title="Xóa bài"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-4 py-3 border border-indigo-200 rounded-xl font-bold text-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="Tiêu đề bài viết..." disabled={loading} />
                                <div className="relative">
                                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full px-4 py-3 border border-indigo-200 rounded-xl min-h-[200px] text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-mono resize-y" placeholder="Nội dung (Markdown supported)..." disabled={loading} />
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        <button onClick={handleCancelEdit} disabled={loading} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors">Hủy</button>
                                        <button onClick={handleSaveEdit} disabled={loading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1">{loading ? <LoadingSpinner size="xs" color="white"/> : <><Save className="w-3 h-3"/> Lưu</>}</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 mb-4 leading-snug">{post.title}</h2>
                                <article className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-indigo-600 prose-img:rounded-xl prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-pre:rounded-xl">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{post.content || ''}</ReactMarkdown>
                                </article>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};