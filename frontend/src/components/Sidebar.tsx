import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import { LayoutDashboard, Trophy, FileCode, MessageSquare, Settings, Shield } from 'lucide-react';
import type { Page } from '../types';

interface SidebarProps {
    onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
    const { currentUser, navigate } = useAppContext();
    const location = useLocation();

    const navItems = [
        { id: 'problems', label: 'Cuộc thi', icon: Trophy, path: '/problems' },
        { id: 'leaderboard', label: 'Bảng xếp hạng', icon: LayoutDashboard, path: '/leaderboard' }, // Placeholder logic handled in navigate
        { id: 'discussion', label: 'Thảo luận', icon: MessageSquare, path: '/discussion' }, // Placeholder
        { id: 'my-submissions', label: 'Code & Bài nộp', icon: FileCode, path: '/my-submissions' },
    ];

    const isActive = (id: string) => {
        if (id === 'problems' && (location.pathname === '/problems' || location.pathname === '/')) return true;
        return location.pathname.includes(id);
    };

    const handleItemClick = (id: string) => {
        // Mapping basic IDs to Page types used in navigate
        if (id === 'leaderboard') {
             // If leaderboard isn't a main page yet, redirect to problems or show toast
             // For now mapping to problems for demo if page doesn't exist
             navigate('problems'); 
        } else if (id === 'discussion') {
             navigate('problems'); // Placeholder
        } else {
            navigate(id as Page);
        }
        
        if (onCloseMobile) onCloseMobile();
    };

    return (
        <nav className="space-y-1">
            <div className="px-3 mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menu</p>
            </div>
            
            {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-all ${
                        isActive(item.id)
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <item.icon className={`w-5 h-5 ${isActive(item.id) ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {item.label}
                </button>
            ))}

            <div className="my-4 border-t border-slate-100" />

            {currentUser?.role === 'owner' && (
                <>
                    <div className="px-3 mb-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin</p>
                    </div>
                    <button
                        onClick={() => { navigate('admin'); if(onCloseMobile) onCloseMobile(); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-all ${
                            location.pathname === '/admin'
                                ? 'bg-slate-800 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <Shield className="w-5 h-5" />
                        Quản trị hệ thống
                    </button>
                </>
            )}
        </nav>
    );
};