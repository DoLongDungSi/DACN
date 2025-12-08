import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { LayoutDashboard, Trophy, FileText, User, Settings, Shield, Menu } from 'lucide-react';
import type { Page } from '../types';

const navItems: Array<{ page: Page; label: string; icon: React.ReactNode }> = [
  { page: 'problems', label: 'Cuộc thi', icon: <Trophy className="w-5 h-5" /> },
  { page: 'my-submissions', label: 'Bài nộp', icon: <FileText className="w-5 h-5" /> },
  { page: 'profile', label: 'Hồ sơ', icon: <User className="w-5 h-5" /> },
  { page: 'settings', label: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
];

export const Sidebar: React.FC = () => {
  const { currentUser, page, navigate } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (targetPage: Page) => {
    navigate(targetPage);
    setMobileOpen(false);
  };

  return (
    <>
      <button className="lg:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-xl shadow-md border" onClick={() => setMobileOpen(true)}>
        <Menu className="w-6 h-6 text-slate-700" />
      </button>

      <aside className={`fixed lg:static inset-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 h-screen flex flex-col`}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center gap-2">
            <LayoutDashboard className="w-8 h-8 text-indigo-600" /> MLJudge
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => handleNavigate(item.page)}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all group ${
                page === item.page || (item.page === 'problems' && page === 'problem-detail')
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`mr-3 transition-colors ${page === item.page ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {currentUser?.role === 'owner' && (
            <>
              <div className="my-4 border-t border-slate-100 mx-2" />
              <button
                onClick={() => handleNavigate('admin')}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all group ${
                  page === 'admin'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Shield className="w-5 h-5 mr-3" />
                Quản trị viên
              </button>
            </>
          )}
        </nav>
        
        {/* User Mini Profile (Optional footer) */}
        {currentUser && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${currentUser.avatarColor || 'bg-slate-400'}`}>
                        {currentUser.username[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-800 truncate">{currentUser.username}</p>
                        <p className="text-xs text-slate-500 truncate capitalize">{currentUser.role}</p>
                    </div>
                </div>
            </div>
        )}
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
    </>
  );
};