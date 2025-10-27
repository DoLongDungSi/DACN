import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X } from 'lucide-react';
import { useAppContext } from '../../hooks/useAppContext'; // Assuming context manages user updates
import { getCroppedImg } from '../../utils'; // Import the utility function
import { api } from '../../api'; // Import the api helper
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
    const { setCurrentUser, setLoading, loading, setError } = useAppContext(); // Get necessary functions from context
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


    const handleAvatarUpdate = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current) {
            setLoading(true);
            setError('');
            try {
                // Get the cropped image as a File object (using the utility function)
                const croppedImageFile = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    originalFileName, // Use the original file name
                    128 // Target size for the avatar
                );

                if (!croppedImageFile) {
                    throw new Error("Không thể tạo file ảnh đã cắt.");
                }

                // Convert the File to base64 Data URL for sending
                const reader = new FileReader();
                reader.readAsDataURL(croppedImageFile);
                reader.onloadend = async () => {
                    const base64data = reader.result as string; // Assert as string
                    try {
                        const data = await api.put<{ user: typeof currentUser }>("/users/me/avatar", { avatarDataUrl: base64data });
                         if(data?.user) {
                            setCurrentUser(data.user); // Update user in context
                            onClose(); // Close modal on success
                        } else {
                             throw new Error("Dữ liệu người dùng trả về không hợp lệ.");
                        }
                    } catch (uploadError: any) {
                         setError(uploadError.message || "Lỗi khi tải ảnh đại diện lên.");
                    } finally {
                        setLoading(false);
                    }
                };
                 reader.onerror = () => {
                     setError("Không thể đọc file ảnh đã cắt.");
                     setLoading(false);
                 };

            } catch (cropError: any) {
                setError(cropError.message || "Lỗi khi cắt ảnh.");
                setLoading(false);
            }
        } else {
             setError("Vùng cắt chưa hoàn tất hoặc ảnh chưa tải.");
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
                        onClick={handleAvatarUpdate}
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
