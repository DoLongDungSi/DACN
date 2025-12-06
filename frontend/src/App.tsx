import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar'; // Import mới
import { AuthPage } from './pages/AuthPage';
import { ProblemsListPage } from './pages/ProblemsListPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ProblemEditorPage } from './pages/ProblemEditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { BillingPage } from './pages/BillingPage';
import { ConfirmModal } from './components/Common/ConfirmModal';
import { LoadingSpinner } from './components/Common/LoadingSpinner';
import { Toast } from './components/Common/Toast';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
            {/* Header */}
            <Header 
                onAvatarClick={() => setIsRightSidebarOpen(true)} 
                onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
            
            {/* Right User Sidebar (Drawer) */}
            <RightSidebar 
                isOpen={isRightSidebarOpen} 
                onClose={() => setIsRightSidebarOpen(false)} 
            />

            <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
                {/* Left Sidebar (Navigation) - Connected conceptually to Logo area */}
                <div className={`
                    fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white lg:bg-transparent border-r lg:border-none border-slate-200 z-30 
                    transform lg:transform-none transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    <div className="h-full overflow-y-auto py-6 pl-4 pr-2">
                        <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
                    </div>
                </div>

                {/* Mobile Backdrop */}
                {isMobileMenuOpen && (
                    <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
                
                {/* Main Content */}
                <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

const FullWidthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
             {/* Simplified Header for Full Width Pages if needed, or just content */}
            <main className="flex-1 relative">
                 {children}
            </main>
        </div>
    );
}

const AppContent: React.FC = () => {
    const { currentView, loading, toastMessage, toastType, clearToast } = useAppContext();
    const location = useLocation();

    if (currentView === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <LoadingSpinner />
                <p className="ml-4 text-slate-600 font-medium animate-pulse">Đang tải dữ liệu...</p>
            </div>
        );
    }

    if (currentView === "auth") {
        return <AuthPage />;
    }

    const isFullWidth = location.pathname.startsWith('/problem-editor');

    return (
        <>
            {loading && <LoadingSpinner overlay={true} />}
            
            {isFullWidth ? (
                <FullWidthLayout>
                     <Routes>
                        <Route path="/problem-editor" element={<ProblemEditorPage />} />
                    </Routes>
                </FullWidthLayout>
            ) : (
                <MainLayout>
                    <Routes>
                        <Route path="/" element={<ProblemsListPage />} />
                        <Route path="/problems" element={<ProblemsListPage />} />
                        <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
                        <Route path="/my-submissions" element={<MySubmissionsPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/profile/:identifier" element={<ProfilePage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/billing" element={<BillingPage />} />
                        <Route path="*" element={<Navigate to="/problems" replace />} />
                    </Routes>
                </MainLayout>
            )}
            
            <ConfirmModal />
            {toastMessage && toastType && (
                <Toast message={toastMessage} type={toastType} onClose={clearToast} />
            )}
        </>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

export default App;