import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import default từ App.tsx
import './index.css';

// Component bắt lỗi (Error Boundary) đơn giản
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-50 text-red-900 min-h-screen font-mono">
          <h1 className="text-2xl font-bold mb-4">⚠️ Ứng dụng bị Crash</h1>
          <p className="mb-2">Có lỗi xảy ra khiến trang web không thể hiển thị:</p>
          <div className="bg-white p-4 rounded border border-red-200 overflow-auto whitespace-pre-wrap text-sm">
            {this.state.error?.toString()}
          </div>
          <p className="mt-4 text-sm text-gray-600">Hãy chụp màn hình lỗi này để sửa code.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Không tìm thấy element #root trong index.html");
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}