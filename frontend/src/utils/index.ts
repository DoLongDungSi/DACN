import { type PixelCrop } from 'react-image-crop';

// Utility functions

/**
 * Creates a File object from a cropped image area.
 * @param image - The source image element.
 * @param crop - The pixel crop dimensions.
 * @param fileName - The desired filename for the output file.
 * @param targetWidth - The desired width (and height) of the output image.
 * @returns A Promise resolving to the cropped File or null.
 */
export function getCroppedImg(
    image: HTMLImageElement,
    crop: PixelCrop,
    fileName: string,
    targetWidth = 128,
): Promise<File | null> {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetWidth;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return Promise.resolve(null);
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    // devicePixelRatio slightly increases sharpness on retina devices
    // but can cause issues with incorrect coordinates, keeping it simple for now
    // const pixelRatio = window.devicePixelRatio;
    const pixelRatio = 1;

    canvas.width = Math.floor(targetWidth * pixelRatio);
    canvas.height = Math.floor(targetWidth * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    // ctx.imageSmoothingQuality = 'high'; // Can uncomment if needed

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();

    // Move the crop origin to the canvas origin (0,0)
    ctx.translate(-cropX, -cropY);
    // Move the origin to the center of the original position
    ctx.translate(centerX, centerY);
    // // Rotate the canvas
    // ctx.rotate(rotate * Math.PI / 180) // Rotation logic removed for simplicity
    // // Scale the canvas
    // ctx.scale(scale, scale) // Scaling logic removed for simplicity
    // Move the center of the image to the origin (0,0)
    ctx.translate(-centerX, -centerY);

    ctx.drawImage(
        image,
        0, // sourceX
        0, // sourceY
        image.naturalWidth, // sourceWidth
        image.naturalHeight, // sourceHeight
        0, // destX
        0, // destY
        image.naturalWidth, // destWidth
        image.naturalHeight // destHeight
    );


    // Draw the cropped area onto the smaller canvas
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0, // destination x
      0, // destination y
      targetWidth, // destination width
      targetWidth  // destination height
    );


    ctx.restore();

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                // eslint-disable-next-line no-console
                console.error('Canvas is empty');
                resolve(null); // Resolve with null instead of rejecting
                return;
            }
            try {
                const file = new File([blob], fileName, { type: blob.type });
                resolve(file);
            } catch (error) {
                console.error('Error creating file from blob:', error);
                resolve(null); // Resolve with null on error
            }
        }, 'image/png', 1); // Use PNG format, quality 1 (max)
    });
}


// Add other utility functions here if needed
