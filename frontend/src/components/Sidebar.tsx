import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { LayoutDashboard, BookOpen, FileText, User, Settings, Shield, Menu, X } from 'lucide-react';
import type { Page } from '../types';

const navItems: Array<{ page: Page; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
  { page: 'problems' as Page, label: 'Bài toán', icon: <BookOpen className="w-5 h-5" /> },
  { page: 'my-submissions' as Page, label: 'Bài nộp', icon: <FileText className="w-5 h-5" /> },
  { page: 'profile' as Page, label: 'Hồ sơ', icon: <User className="w-5 h-5" /> },
  { page: 'settings' as Page, label: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
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
      {/* Mobile toggle button - to be placed in TopHeader later */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border hover:shadow-xl transition-all"
        onClick={() => setMobileOpen(true)}
        aria-label="Mở menu"
      >
        <Menu className="w-6 h-6 text-slate-700" />
      </button>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-0 z-40 lg:z-auto w-64 lg:w-64 bg-white shadow-lg lg:shadow-none border-r border-slate-200 transform lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 transition-transform duration-300 ease-in-out lg:h-screen h-screen overflow-y-auto`}>
        <div className="p-4 border-b border-slate-100 lg:pt-8">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <LayoutDashboard className="w-6 h-6 mr-2 text-indigo-600" />
            MLJudge
          </h2>
        </div>
        <nav className="mt-4 px-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => handleNavigate(item.page)}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-left transition-all group ${
                page === item.page
                  ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500 shadow-md'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-700'
              }`}
            >
              <span className="w-6 mr-3 flex-shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
          {currentUser?.role === 'owner' && (
            <button
              onClick={() => handleNavigate('admin')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-left transition-all group ${
                page === 'admin'
                  ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500 shadow-md'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-700'
              }`}
            >
              <Shield className="w-5 h-5 mr-3" />
              Quản lý
            </button>
          )}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
};
