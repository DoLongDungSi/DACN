import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { ToastProvider } from './contexts/ToastContext';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { LoadingSpinner } from './components/Common/LoadingSpinner';
import { ConfirmModal } from './components/Common/ConfirmModal'; // [THÊM] Import Modal

// Pages
import { AuthPage } from './pages/AuthPage';
import { ProblemsListPage } from './pages/ProblemsListPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { ProblemEditorPage } from './pages/ProblemEditorPage';
import { ProfilePage } from './pages/ProfilePage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { BillingPage } from './pages/BillingPage';

// --- Guards ---
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAppContext();
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'owner')) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAppContext();
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!currentUser) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAppContext();
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (currentUser) return <Navigate to="/" replace />; 
  return <>{children}</>;
};

// --- Layout ---
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex flex-1 pt-16">
        <Sidebar />
        <main className="flex-1 w-full md:ml-64 p-6 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppProvider>
        <ToastProvider>
          {/* [THÊM] Đặt ConfirmModal ở đây để dùng được toàn app */}
          <ConfirmModal /> 
          
          <Routes>
            <Route path="/auth" element={
              <PublicOnlyRoute>
                <AuthPage />
              </PublicOnlyRoute>
            } />
            
            <Route path="*" element={
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/problems" replace />} />
                  <Route path="/problems" element={<ProblemsListPage />} />
                  <Route path="/problems/:id" element={<ProblemDetailPage />} />
                  
                  <Route path="/problems/create" element={<AdminRoute><ProblemEditorPage /></AdminRoute>} />
                  <Route path="/problems/:id/edit" element={<AdminRoute><ProblemEditorPage /></AdminRoute>} />
                  <Route path="/problem-editor" element={<AdminRoute><ProblemEditorPage /></AdminRoute>} />
                  <Route path="/problem-editor/:id" element={<AdminRoute><ProblemEditorPage /></AdminRoute>} />

                  <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                  <Route path="/profile/:identifier" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                  <Route path="/my-submissions" element={<PrivateRoute><MySubmissionsPage /></PrivateRoute>} />
                  <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                  <Route path="/billing" element={<PrivateRoute><BillingPage /></PrivateRoute>} />
                  <Route path="/admin/*" element={<AdminRoute><AdminPage /></AdminRoute>} />
                  <Route path="/discussions" element={<div className="p-4">Discussion Page (Coming Soon)</div>} />
                </Routes>
              </MainLayout>
            } />
          </Routes>
        </ToastProvider>
      </AppProvider>
    </Router>
  );
}

export default App;