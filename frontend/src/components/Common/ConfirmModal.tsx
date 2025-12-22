import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';

export const ConfirmModal: React.FC = () => {
    const { confirmModal, closeConfirmModal } = useAppContext();

    if (!confirmModal?.isOpen) {
        return null;
    }

    return (
        // SỬA: Thay z-50 thành z-[1000] để đè lên Spinner (z-50) và Toast (z-100)
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm relative z-[1001]">
                <h3 className="text-lg font-bold text-slate-800">{confirmModal.title}</h3>
                <p className="mt-2 text-sm text-slate-600">
                    {confirmModal.message}
                </p>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        // SỬA: Thêm type="button" để tránh submit form ngoài ý muốn
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation(); // Ngăn chặn sự kiện nổi bọt
                            closeConfirmModal();
                        }}
                        // SỬA: Thêm relative z-10 để đảm bảo nút nổi lên trên bề mặt
                        className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition-colors relative z-10"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            confirmModal.onConfirm();
                            // Tùy chọn: Đóng modal ngay lập tức nếu logic onConfirm là bất đồng bộ và bạn muốn UI phản hồi nhanh
                            // closeConfirmModal(); 
                        }}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors relative z-10"
                    >
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};