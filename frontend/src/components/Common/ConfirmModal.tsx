import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';

export const ConfirmModal: React.FC = () => {
    const { confirmModal, closeConfirmModal } = useAppContext();

    if (!confirmModal?.isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold text-slate-800">{confirmModal.title}</h3>
                <p className="mt-2 text-sm text-slate-600">
                    {confirmModal.message}
                </p>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={closeConfirmModal}
                        className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => {
                            confirmModal.onConfirm();
                            // Optionally close modal immediately after confirm starts
                            // closeConfirmModal();
                        }}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
                    >
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};
