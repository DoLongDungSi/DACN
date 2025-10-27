import React from 'react';
// Correct import paths
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
import { Toast } from './components/Common/Toast';

// Main application component that decides which view/page to render
const AppContent: React.FC = () => {
    // Get state and functions from context
    const { currentView, page, loading, toastMessage, toastType, clearToast } = useAppContext();

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
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Header />
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative">
                 {/* Global Loading Indicator */}
                 {loading && <LoadingSpinner overlay={true} />}

                {/* Page Content - Render based on 'page' state */}
                {page === "problems" && <ProblemsListPage />}
                {page === "problem-detail" && <ProblemDetailPage />}
                {page === "my-submissions" && <MySubmissionsPage />}
                {page === "profile" && <ProfilePage />}
                {page === "admin" && <AdminPage />}
                {page === "problem-editor" && <ProblemEditorPage />}
                {page === "settings" && <SettingsPage />}
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

