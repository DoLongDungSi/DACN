import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { useNavigate } from 'react-router-dom';
import { UserAvatar } from './Common/UserAvatar';

const Header = () => {
  const { currentUser, handleLogout } = useAppContext(); // Đã sửa thành currentUser
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onLogout = () => {
    handleLogout();
    navigate('/auth');
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/mljudge-logo.svg" alt="Logo" className="h-8 w-8" />
          <span className="text-xl font-bold text-gray-900 hidden sm:block">MLJudge</span>
        </a>
      </div>

      <div className="flex-1 max-w-2xl mx-4 hidden md:block">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition duration-150 ease-in-out"
            placeholder="Tìm kiếm..."
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {currentUser ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 focus:outline-none hover:bg-gray-50 p-1.5 rounded-full transition-colors border border-transparent hover:border-gray-200"
            >
              <UserAvatar user={currentUser} size="sm" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-700 leading-none">{currentUser.username}</p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{currentUser.role}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 py-1 focus:outline-none z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm text-gray-500">Đăng nhập với</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{currentUser.email}</p>
                </div>
                
                <div className="py-1">
                  <a href="/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <span className="mr-3">👤</span> Hồ sơ của tôi
                  </a>
                  <a href="/settings" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <span className="mr-3">⚙️</span> Cài đặt
                  </a>
                </div>

                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={onLogout}
                    className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                     <span className="mr-3">🚪</span> Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <a href="/auth?mode=login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Đăng nhập</a>
            <a href="/auth?mode=register" className="px-4 py-2 text-sm font-medium text-white bg-black rounded-full hover:bg-gray-800 transition-colors">Đăng ký</a>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;