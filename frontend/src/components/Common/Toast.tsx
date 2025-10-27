import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react'; // Import icons

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number; // Duration in milliseconds
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer); // Cleanup timer on unmount or change
    }, [onClose, duration]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success': return 'bg-green-50 border-green-200';
            case 'error': return 'bg-red-50 border-red-200';
            case 'info':
            default: return 'bg-blue-50 border-blue-200';
        }
    };
     const getTextColor = () => {
        switch (type) {
            case 'success': return 'text-green-800';
            case 'error': return 'text-red-800';
            case 'info':
            default: return 'text-blue-800';
        }
    };


    return (
        <div className={`fixed bottom-5 right-5 z-[100] p-4 rounded-lg shadow-lg border ${getBgColor()} max-w-sm animate-fade-in-up`}> {/* Increased z-index */}
            <div className="flex items-start">
                <div className="flex-shrink-0 mr-3">
                    {getIcon()}
                </div>
                <div className={`flex-1 text-sm font-medium ${getTextColor()}`}>
                    {message}
                </div>
                <button
                    onClick={onClose}
                    className={`ml-4 -mr-1 -mt-1 p-1 rounded-md ${getTextColor()} opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue'}-500`}
                     aria-label="Đóng thông báo"
               >
                    <X className="w-4 h-4" />
                </button>
            </div>
             {/* Simple CSS animation (embedded for simplicity, move to index.css if preferred) */}
             <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

