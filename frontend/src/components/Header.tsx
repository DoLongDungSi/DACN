import React, { useState, useRef, useEffect } from 'react';
import { User as UserIcon, LogOut, FileText, ChevronDown, Settings, Shield, PlusCircle } from "lucide-react";
import { useAppContext } from '../hooks/useAppContext';
import type { Page } from '../types';
import { UserAvatar } from './Common/UserAvatar';

export const Header: React.FC = () => {
    const { currentUser, page, navigate, handleLogout, setEditingProblem, setCurrentView } = useAppContext();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    const handleNavigate = (targetPage: Page, targetId?: number | string | null) => {
        navigate(targetPage, targetId ?? null);
        setDropdownOpen(false);
    };

    const handleViewProfile = () => {
        if (currentUser) {
            handleNavigate('profile', currentUser.username);
        }
    }

    return (
         <header className="bg-white shadow-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-8">
                    <button onClick={() => handleNavigate('problems')} className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-indigo-600"><img src="/mljudge-logo.svg" alt="MLJudge Logo" className="h-8 w-8 mr-2" /></span>
                    </button>
                    <nav className="hidden md:flex space-x-2 items-center">
                        <button
                            onClick={() => handleNavigate('problems')}
                            className={`font-semibold px-4 py-2 rounded-lg ${page === 'problems' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'}`}
                        >
                            Bài toán
                        </button>
                         {currentUser?.role === "owner" && (
                            <button
                                onClick={() => handleNavigate('admin')}
                                className={`font-semibold px-4 py-2 rounded-lg flex items-center ${page === 'admin' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'}`}
                            >
                                <Shield className="w-5 h-5 mr-2" />
                                Quản lý
                            </button>
                        )}
                         {(currentUser?.role === "owner" || currentUser?.role === "creator") && page === 'problems' && (
                            <button
                                onClick={() => {
                                    setEditingProblem("new");
                                    handleNavigate('problem-editor');
                                }}
                                className="bg-indigo-600 text-white font-bold py-2 px-3 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow-sm text-sm"
                                >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Tạo mới
                            </button>
                         )}
                    </nav>
                </div>
                {currentUser ? (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center space-x-2"
                            aria-expanded={dropdownOpen}
                            aria-haspopup="true"
                        >
                             <UserAvatar user={currentUser} size="w-10 h-10" textClass="text-lg" />
                            <span className="hidden sm:inline font-semibold text-slate-700">{currentUser.username}</span>
                            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg py-2 z-50 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <button
                                    onClick={handleViewProfile}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
                                >
                                    <UserIcon className="w-5 h-5 mr-3" />
                                    Hồ sơ
                                </button>
                                <button
                                    onClick={() => handleNavigate('my-submissions')}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
                                >
                                    <FileText className="w-5 h-5 mr-3" />
                                    Bài nộp
                                </button>
                                <button
                                     onClick={() => handleNavigate('settings')}
                                     className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
                                >
                                    <Settings className="w-5 h-5 mr-3" />
                                    Cài đặt
                                </button>
                                <hr className="my-1 border-slate-200" />
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                                >
                                    <LogOut className="w-5 h-5 mr-3" />
                                    Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                 ) : (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentView('auth')}
                            className="font-semibold px-3 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
                        >
                            Đăng nhập
                        </button>
                        <button
                            onClick={() => setCurrentView('auth')}
                            className="font-semibold px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                        >
                            Đăng ký
                        </button>
                    </div>
                 )}
            </div>
        </header>
    );
};
