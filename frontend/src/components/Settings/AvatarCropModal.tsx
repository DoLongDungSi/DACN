import { Fragment, useState, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Cropper from 'react-easy-crop';

// Định nghĩa interface để tránh lỗi build
interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (file: File) => void;
}

// SỬA LỖI QUAN TRỌNG: Kiểm tra blob trước khi set crossOrigin
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    
    // Nếu là ảnh từ server (http/https) thì cần anonymous để vẽ canvas không bị lỗi
    // Nếu là ảnh local (blob:) thì KHÔNG ĐƯỢC set crossOrigin, nếu không sẽ lỗi
    if (!url.startsWith('blob:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    
    image.src = url;
  });

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
}

// Export thường (không default) để khớp với import bên SettingsPage
export function AvatarCropModal({
  isOpen,
  onClose,
  imageUrl,
  onSave,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
      if (croppedBlob) {
        const file = new File([croppedBlob], 'avatar-cropped.jpg', {
          type: 'image/jpeg',
        });
        onSave(file);
        onClose();
      }
    } catch (e) {
      console.error('Lỗi cắt ảnh:', e);
      alert('Có lỗi xảy ra khi xử lý ảnh. Hãy thử ảnh khác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4"
                >
                  Cắt ảnh đại diện
                </Dialog.Title>

                {/* Sửa background từ gray-900 thành gray-200 để dễ nhìn ảnh hơn */}
                {/* Dùng style height cứng để đảm bảo hiển thị */}
                <div 
                  className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-6"
                  style={{ height: '400px' }} 
                >
                  <Cropper
                    image={imageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    objectFit="contain"
                    // Tắt showGrid mặc định cho đỡ rối nếu muốn
                    showGrid={true} 
                  />
                </div>

                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Thu phóng
                    </label>
                    <span className="text-sm text-gray-500">{zoom}x</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-indigo-600"
                  />
                </div>

                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? 'Đang xử lý...' : 'Lưu ảnh'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}