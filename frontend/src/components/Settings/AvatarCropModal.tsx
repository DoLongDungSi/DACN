import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X } from 'lucide-react';
import { useAppContext } from '../../hooks/useAppContext';
import { getCroppedImg } from '../../utils';
import { LoadingSpinner } from '../Common/LoadingSpinner';


interface AvatarCropModalProps {
    isOpen: boolean;
    onClose: () => void;
    imgSrc: string;
    originalFileName: string;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
    isOpen,
    onClose,
    imgSrc,
    originalFileName,
}) => {
    const { handleAvatarUpdate, loading, showToast } = useAppContext();
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(
            makeAspectCrop(
                {
                    // You can optionally set initial crop size here
                    unit: '%',
                    width: 90, // Example: start with 90% width crop
                },
                1, // Aspect ratio 1:1
                width,
                height
            ),
            width,
            height
        );
        setCrop(initialCrop);
    }, []);


    const handleSave = async () => {
        if (!completedCrop?.width || !completedCrop?.height || !imgRef.current) {
            showToast("Vùng cắt chưa hoàn tất hoặc ảnh chưa tải.", "error");
            return;
        }

        try {
            const croppedImageFile = await getCroppedImg(
                imgRef.current,
                completedCrop,
                originalFileName || 'avatar.png',
                128
            );

            if (!croppedImageFile) {
                showToast("Không thể tạo file ảnh đã cắt.", "error");
                return;
            }

            await handleAvatarUpdate(croppedImageFile, originalFileName || 'avatar.png');
        } catch (error: any) {
            showToast(error.message || "Lỗi khi xử lý ảnh.", "error");
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg relative">
                 <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-700"
                    aria-label="Đóng"
                >
                    <X size={24} />
                </button>
                <h2 className="text-xl font-bold mb-4 text-slate-800">Cắt ảnh đại diện</h2>
                <div className="max-h-[60vh] overflow-auto mb-4 flex justify-center bg-slate-100 p-2 rounded">
                    {imgSrc ? (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={1} // Enforce square aspect ratio
                            circularCrop // Make the crop area circular
                            keepSelection // Keep selection when clicking outside
                        >
                            <img
                                ref={imgRef}
                                alt="Ảnh cần cắt"
                                src={imgSrc}
                                style={{ maxHeight: '55vh' }} // Limit image display height
                                onLoad={onImageLoad}
                            />
                        </ReactCrop>
                    ) : (
                        <p className="text-slate-500">Đang tải ảnh...</p> // Placeholder while image loads
                    )}
                </div>
                <div className="flex justify-end mt-6 space-x-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !completedCrop?.width} // Disable if loading or no crop
                        className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                    >
                        {loading ? <LoadingSpinner/> : 'Lưu ảnh'}
                    </button>
                </div>
            </div>
        </div>
    );
};
