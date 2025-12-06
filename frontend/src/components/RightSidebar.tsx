import React from 'react';
import { X, User, FileText, Settings, LogOut, Crown } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { UserAvatar } from './Common/UserAvatar';

interface RightSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isOpen, onClose }) => {
    const { currentUser, handleLogout, navigate, subscription } = useAppContext();

    if (!currentUser) return null;

    const menuItems = [
        { 
            icon: User, 
            label: 'Hồ sơ cá nhân', 
            action: () => navigate('profile', currentUser.username) 
        },
        { 
            icon: FileText, 
            label: 'Bài nộp của tôi', 
            action: () => navigate('my-submissions') 
        },
        { 
            icon: Settings, 
            label: 'Cài đặt tài khoản', 
            action: () => navigate('settings') 
        },
    ];

    const onLogoutClick = async () => {
        await handleLogout();
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Panel */}
            <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        {/* Sử dụng size 'lg' cho avatar to vừa phải và không bị vỡ */}
                        <UserAvatar user={currentUser} size="lg" />
                        <div className="overflow-hidden">
                            <div className="font-bold text-slate-900 truncate text-base">{currentUser.username}</div>
                            <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Premium Badge */}
                {subscription?.status === 'active' && (
                    <div className="mx-5 mt-5 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl flex items-center gap-3 animate-fade-in">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600 shadow-sm">
                            <Crown className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-amber-800">Tài khoản Premium</div>
                            <div className="text-xs text-amber-600">Đang hoạt động</div>
                        </div>
                    </div>
                )}

                {/* Menu Items */}
                <div className="p-3 mt-2 space-y-1">
                    {menuItems.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                item.action();
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all group font-medium"
                        >
                            <item.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Logout Button (Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-slate-100 bg-white">
                    <button 
                        onClick={onLogoutClick}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Đăng xuất
                    </button>
                </div>
            </div>
        </>
    );
};