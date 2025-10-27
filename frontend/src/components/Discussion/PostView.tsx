import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns'; // Added isValid
import { DiscussionPost, User } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { useAppContext } from '../../hooks/useAppContext';

interface PostViewProps {
    post: DiscussionPost | null;
    currentUser: User | null;
    handleVote: (targetType: 'posts' | 'comments', targetId: number, voteType: 'up' | 'down') => void;
}

// Helper function to safely parse and format date (can be moved to utils if used elsewhere)
const safeFormatDistanceToNow = (dateString: string | null | undefined): string => {
    if (!dateString) return 'không rõ thời gian';
    try {
        const date = parseISO(dateString);
        if (isValid(date)) {
            return formatDistanceToNow(date, { addSuffix: true });
        }
        return 'thời gian không hợp lệ';
    } catch (e) {
        console.error("Error parsing date:", dateString, e);
        return 'lỗi thời gian';
    }
};

export const PostView: React.FC<PostViewProps> = ({ post, currentUser, handleVote }) => {
    const { navigateToProfile } = useAppContext();

    // Stricter check: ensure post is an object and has a valid id
    if (!post || typeof post !== 'object' || post.id === undefined || post.id === null) {
        // console.error("PostView received invalid post data:", post); // Add log for debugging
        return <p className="text-red-500 p-4">Lỗi: Dữ liệu bài viết không hợp lệ hoặc bị thiếu.</p>;
    }

    // Safely calculate vote count and check user's vote
    const voteCount = (post.upvotedBy?.length || 0) - (post.downvotedBy?.length || 0);
    const userVote = post.upvotedBy?.includes(currentUser?.id ?? -1)
        ? 'up'
        : post.downvotedBy?.includes(currentUser?.id ?? -1)
        ? 'down'
        : null;

    const handleAuthorClick = () => {
        // Prefer userId for navigation
        if (post?.userId !== undefined && post.userId !== null) {
             navigateToProfile(post.userId);
        } else if (post?.username) {
            // Fallback to username, but warn if userId was expected
            console.warn("Navigating by username as userId is missing for post:", post.id);
            navigateToProfile(post.username);
        } else {
             console.error("Cannot navigate to profile, missing both userId and username for post:", post.id);
        }
    };

    // Safely get createdAt string
    const createdAtString = safeFormatDistanceToNow(post.createdAt);

    return (
        <div className="flex items-start space-x-4 p-1">
            {/* Voting Section */}
            <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                <button
                    onClick={() => handleVote('posts', post.id, 'up')} // post.id is guaranteed here
                    disabled={!currentUser}
                    className="p-1 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                    aria-label="Upvote post"
                >
                    <ArrowUp
                        className={`w-5 h-5 ${userVote === 'up' ? 'text-indigo-600 fill-indigo-200' : ''}`}
                        strokeWidth={userVote === 'up' ? 2.5 : 2}
                    />
                </button>
                <span className="font-bold text-lg text-slate-700 select-none" aria-label={`Score: ${voteCount}`}>
                    {voteCount}
                </span>
                <button
                    onClick={() => handleVote('posts', post.id, 'down')} // post.id is guaranteed here
                    disabled={!currentUser}
                    className="p-1 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                    aria-label="Downvote post"
                >
                    <ArrowDown
                        className={`w-5 h-5 ${userVote === 'down' ? 'text-red-600 fill-red-200' : ''}`}
                        strokeWidth={userVote === 'down' ? 2.5 : 2}
                    />
                </button>
            </div>

            {/* Post Content Section */}
            <div className="flex-grow min-w-0">
                {/* Author Info */}
                <div className="flex items-center space-x-2 text-sm text-slate-500 mb-2">
                     <button onClick={handleAuthorClick} className="flex items-center space-x-2 group focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded" aria-label={`Xem hồ sơ của ${post.username || 'người dùng'}`}>
                        {/* UserAvatar needs a valid user object structure */}
                        <UserAvatar user={{ username: post.username || '?', avatarColor: post.avatarColor || 'bg-slate-400', avatarUrl: post.avatarUrl }} size="w-6 h-6" textClass="text-xs" />
                        <span className="font-semibold text-slate-700 group-hover:text-indigo-600 group-hover:underline">
                            {post.username || <span className="italic">Ẩn danh</span>}
                        </span>
                    </button>
                    <span>•</span>
                    <span>{createdAtString}</span> {/* Use safe string */}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-slate-900 mt-1 mb-4 break-words">
                    {post.title || <span className="italic text-slate-500">Không có tiêu đề</span>}
                </h2>

                {/* Content */}
                <div
                    className="prose prose-sm max-w-none prose-slate"
                    dangerouslySetInnerHTML={{ __html: post.content || '<p class="italic text-slate-500">Không có nội dung</p>' }}
                ></div>
            </div>
        </div>
    );
};

