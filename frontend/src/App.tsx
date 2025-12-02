import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { Header } from './components/Header';
import { AuthPage } from './pages/AuthPage';
import { ProblemsListPage } from './pages/ProblemsListPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ProblemEditorPage } from './pages/ProblemEditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { ConfirmModal } from './components/Common/ConfirmModal';
import { LoadingSpinner } from './components/Common/LoadingSpinner';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Common/Toast';

// Main application component that decides which view/page to render
const AppContent: React.FC = () => {
    // Get state and functions from context
    const { currentView, loading, toastMessage, toastType, clearToast } = useAppContext();

    if (currentView === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner />
                <p className="ml-4 text-slate-500">Đang tải dữ liệu...</p>
            </div>
        );
    }

    if (currentView === "auth") {
        return <AuthPage />;
    }

    // Main authenticated view
    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-800">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-y-auto">
                     {/* Global Loading Indicator */}
                     {loading && <LoadingSpinner overlay={true} />}

                    <Routes>
                        <Route path="/" element={<ProblemsListPage />} />
                        <Route path="/problems" element={<ProblemsListPage />} />
                        <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
                        <Route path="/my-submissions" element={<MySubmissionsPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/profile/:identifier" element={<ProfilePage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/problem-editor" element={<ProblemEditorPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/problems" replace />} />
                    </Routes>
                </main>
                 <ConfirmModal /> {/* Render the confirmation modal globally */}

                 {/* Render Toast component if there's a message */}
                 {toastMessage && toastType && (
                    <Toast
                        message={toastMessage}
                        type={toastType}
                        onClose={clearToast}
                    />
                )}
            </div>
        </div>
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
