import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import { UserAvatar } from './Common/UserAvatar';
import { Crown, Menu } from 'lucide-react';

interface HeaderProps {
    onAvatarClick: () => void;
    onMenuClick?: () => void; // For mobile sidebar toggle
}

export const Header: React.FC<HeaderProps> = ({ onAvatarClick, onMenuClick }) => {
    const { currentUser, subscription } = useAppContext();

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 h-16">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
                {/* Left: Logo Area */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button 
                        className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        onClick={onMenuClick}
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-sm shadow-indigo-200">
                            <span className="text-white font-extrabold text-xl">M</span>
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-violet-700">
                            ML Judge
                        </span>
                    </Link>
                </div>

                {/* Center: BLANK as requested */}
                <div className="flex-1"></div>

                {/* Right: User Area */}
                <div className="flex items-center gap-4">
                    {currentUser ? (
                        <button 
                            onClick={onAvatarClick}
                            className="focus:outline-none group"
                            title="Mở menu người dùng"
                        >
                            <div className="relative transition-transform group-hover:scale-105 group-active:scale-95">
                                <UserAvatar user={currentUser} size="w-9 h-9" textClass="text-sm" />
                                {subscription?.status === 'active' && (
                                    <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full p-[2px] border-2 border-white shadow-sm">
                                        <Crown className="w-2.5 h-2.5 text-white fill-white" />
                                    </div>
                                )}
                            </div>
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link to="/auth" className="text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all">
                                Đăng nhập
                            </Link>
                            <Link to="/auth?mode=register" className="px-4 py-2 text-sm font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-md shadow-slate-200">
                                Đăng ký
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};