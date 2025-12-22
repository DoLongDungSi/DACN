import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast } from '../components/Common/Toast';

// Định nghĩa kiểu cho Toast
interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Hàm để hiển thị toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  // Hàm để đóng toast
  const closeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Render danh sách các toast đang active */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => closeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Hook để sử dụng Toast trong các component khác
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};