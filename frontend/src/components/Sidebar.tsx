import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';

const Sidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { currentUser } = useAppContext(); // Đã sửa thành currentUser

  const isActive = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  const getItemClass = (path: string) => {
    const baseClass = "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-full text-sm font-medium transition-colors duration-200";
    const activeClass = "bg-blue-50 text-blue-600";
    const inactiveClass = "text-gray-600 hover:bg-gray-100 hover:text-gray-900";
    return `${baseClass} ${isActive(path) ? activeClass : inactiveClass}`;
  };

  return (
    <aside className="fixed top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-200 pt-20 hidden md:block">
      <div className="h-full px-2 pb-4 overflow-y-auto scrollbar-hide">
        <div className="space-y-1">
          <a href="/" className={getItemClass('/')}>
            <span className="text-lg">🏠</span>
            <span>Trang chủ</span>
          </a>

          <a href="/problems" className={getItemClass('/problems')}>
            <span className="text-lg">🏆</span>
            <span>Cuộc thi</span>
          </a>

          <a href="/discussions" className={getItemClass('/discussions')}>
             <span className="text-lg">💬</span>
            <span>Thảo luận</span>
          </a>
        </div>

        <div className="my-4 border-t border-gray-100"></div>

        <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Cá nhân
        </div>
        
        <div className="space-y-1">
          <a href="/my-submissions" className={getItemClass('/my-submissions')}>
            <span className="text-lg">📄</span>
            <span>Bài nộp của tôi</span>
          </a>

          <a href="/profile" className={getItemClass('/profile')}>
             <span className="text-lg">👤</span>
            <span>Hồ sơ</span>
          </a>

          <a href="/settings" className={getItemClass('/settings')}>
             <span className="text-lg">⚙️</span>
            <span>Cài đặt</span>
          </a>
          
           <a href="/billing" className={getItemClass('/billing')}>
             <span className="text-lg">💳</span>
            <span>Thanh toán</span>
          </a>
        </div>

         {currentUser?.role === 'owner' || currentUser?.role === 'admin' ? (
            <>
                <div className="my-4 border-t border-gray-100"></div>
                <div className="space-y-1">
                    <a href="/admin" className={getItemClass('/admin')}>
                        <span className="text-lg">🛡️</span>
                        <span>Quản trị viên</span>
                    </a>
                </div>
            </>
         ) : null}
      </div>
    </aside>
  );
};

export default Sidebar;