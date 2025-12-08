import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog } from '@headlessui/react';
import { X, ZoomIn, RotateCw, Save } from 'lucide-react';
import { getCroppedImg } from '../../utils';
import { LoadingSpinner } from '../Common/LoadingSpinner';

interface AvatarCropModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    onCropComplete: (croppedImage: Blob, fileName: string) => void;
    fileName: string;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({ isOpen, onClose, imageSrc, onCropComplete, fileName }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // State chứa URL an toàn (đã thêm timestamp để né cache)
    const [safeImageSrc, setSafeImageSrc] = useState<string>('');

    // Khi imageSrc thay đổi (người dùng chọn ảnh mới), ta tạo một URL mới có ?t=...
    useEffect(() => {
        if (imageSrc) {
            // Nếu là base64 hoặc blob url thì giữ nguyên
            if (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) {
                setSafeImageSrc(imageSrc);
            } else {
                // Nếu là URL mạng (http...), thêm timestamp để bypass cache 304 cũ
                const separator = imageSrc.includes('?') ? '&' : '?';
                setSafeImageSrc(`${imageSrc}${separator}t=${new Date().getTime()}`);
            }
        }
    }, [imageSrc]);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onCropCompleteHandler = useCallback((_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!safeImageSrc) return;
        setIsProcessing(true);
        try {
            // Gọi hàm cắt ảnh từ utils (hàm này cũng đã có logic xử lý CORS)
            const croppedImageBlob = await getCroppedImg(
                safeImageSrc,
                croppedAreaPixels,
                rotation
            );
            
            if (croppedImageBlob) {
                onCropComplete(croppedImageBlob, fileName);
            } else {
                console.error("Cropped image blob is null");
            }
        } catch (e) {
            console.error("Error cropping image:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Reset zoom/rotation khi đóng mở
    useEffect(() => {
        if (isOpen) {
            setZoom(1);
            setRotation(0);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100">
                        <Dialog.Title className="text-xl font-bold text-slate-900">Điều chỉnh ảnh</Dialog.Title>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Cropper Area */}
                    <div className="relative h-80 w-full bg-slate-900">
                        {safeImageSrc && (
                            <Cropper
                                image={safeImageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={1}
                                onCropChange={onCropChange}
                                onCropComplete={onCropCompleteHandler}
                                onZoomChange={setZoom}
                                cropShape="round"
                                showGrid={true}
                                // [QUAN TRỌNG] Bắt buộc phải có dòng này để tránh lỗi Tainted Canvas (đen ảnh)
                                mediaProps={{ crossOrigin: 'anonymous' }} 
                            />
                        )}
                    </div>

                    {/* Controls */}
                    <div className="p-6 space-y-6 bg-white">
                        <div className="space-y-5">
                            {/* Zoom Control */}
                            <div className="flex items-center gap-4">
                                <ZoomIn className="w-5 h-5 text-slate-400" />
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700"
                                />
                            </div>
                            
                            {/* Rotation Control */}
                            <div className="flex items-center gap-4">
                                <RotateCw className="w-5 h-5 text-slate-400" />
                                <input
                                    type="range"
                                    value={rotation}
                                    min={0}
                                    max={360}
                                    step={1}
                                    aria-labelledby="Rotation"
                                    onChange={(e) => setRotation(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700"
                                />
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                disabled={isProcessing}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isProcessing}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? <LoadingSpinner size="xs" color="white" /> : <Save className="w-4 h-4" />}
                                {isProcessing ? 'Đang xử lý...' : 'Lưu ảnh'}
                            </button>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};