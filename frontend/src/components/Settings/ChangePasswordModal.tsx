import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../../hooks/useAppContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';


interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChangePassword: (currentPass: string, newPass: string) => Promise<boolean>; // Returns true on success, false on failure
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onChangePassword }) => {
    const { loading, setLoading, error, setError } = useAppContext(); // Use context for loading/error state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState(""); // Error specific to this modal

    if (!isOpen) return null;

    const resetForm = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setLocalError("");
        setError(""); // Clear global error as well
    }

    const handleClose = () => {
        resetForm();
        onClose();
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError("");
        setError("");

        if (!currentPassword || !newPassword || !confirmPassword) {
            setLocalError("Vui lòng điền đầy đủ các trường.");
            return;
        }
        if (newPassword.length < 6) {
             setLocalError("Mật khẩu mới phải có ít nhất 6 ký tự.");
             return;
        }
        if (newPassword !== confirmPassword) {
            setLocalError("Mật khẩu mới và xác nhận không khớp.");
            return;
        }
         if (newPassword === currentPassword) {
            setLocalError("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
            return;
        }


        setLoading(true);
        const success = await onChangePassword(currentPassword, newPassword);
        setLoading(false);

        if (success) {
            handleClose(); // Close and reset form on success
        } else {
             // Error is likely set in the onChangePassword handler via context's setError
             // If not, set a local error here.
             setLocalError(error || "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md relative">
                 <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-700"
                    aria-label="Đóng"
                >
                    <X size={24} />
                </button>
                <h2 className="text-2xl font-bold mb-6 text-slate-800">Đổi mật khẩu</h2>

                 {localError && <p className="text-red-600 text-sm mb-4">{localError}</p>}
                 {/* Optionally display global error too, if distinct */}
                 {/* {error && !localError && <p className="text-red-600 text-sm mb-4">{error}</p>} */}


                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="currentPassword">
                                Mật khẩu hiện tại
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="newPassword">
                                Mật khẩu mới (ít nhất 6 ký tự)
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="confirmPassword">
                                Xác nhận mật khẩu mới
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-8">
                        <button
                            type="button" // Important: Prevent form submission
                            onClick={handleClose}
                            disabled={loading}
                            className="bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed min-w-[80px] flex justify-center items-center"
                        >
                           {loading ? <LoadingSpinner /> : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
