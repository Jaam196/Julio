/**
 * Image preprocessing utilities for high-precision OCR on thermal/inkjet restaurant tickets.
 */

export interface PreprocessingOptions {
  contrast?: number; // -100 to 100
  brightness?: number; // -100 to 100
  binarizeThreshold?: number; // 0 to 255
  sharpen?: boolean;
  noiseRemoval?: boolean;
  invert?: boolean;
  adaptiveThreshold?: boolean;
}

/**
 * Preprocesses a canvas into a destination canvas applying grayscale, contrast, thresholding, and sharpening.
 */
export function preprocessImage(
  srcCanvas: HTMLCanvasElement,
  destCanvas: HTMLCanvasElement,
  options: PreprocessingOptions = {}
): void {
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) return;

  const width = srcCanvas.width;
  const height = srcCanvas.height;

  destCanvas.width = width;
  destCanvas.height = height;

  destCtx.drawImage(srcCanvas, 0, 0);

  if (width === 0 || height === 0) return;

  const imgData = destCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const contrast = options.contrast ?? 70;
  const brightness = options.brightness ?? 10;
  const binarizeThreshold = options.binarizeThreshold ?? 128;

  // 1. Grayscale & Contrast/Brightness Enhancement
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  let totalLuminance = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Luminosity Grayscale formula
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray += brightness;
    gray = factor * (gray - 128) + 128;
    gray = Math.max(0, Math.min(255, gray));

    if (options.invert) {
      gray = 255 - gray;
    }

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    totalLuminance += gray;
  }

  // 2. Binarization (Adaptive or Fixed threshold)
  if (options.binarizeThreshold !== undefined || options.adaptiveThreshold) {
    const avgLuminance = totalLuminance / (data.length / 4);
    const threshold = options.adaptiveThreshold
      ? (avgLuminance + binarizeThreshold) / 2
      : binarizeThreshold;

    for (let i = 0; i < data.length; i += 4) {
      const val = data[i] < threshold ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  destCtx.putImageData(imgData, 0, 0);

  // 3. Noise Removal (Isolated speckle cleaning)
  if (options.noiseRemoval && width > 2 && height > 2) {
    const srcData = destCtx.getImageData(0, 0, width, height);
    const srcPixels = srcData.data;
    const cleanedData = destCtx.createImageData(width, height);
    const dstPixels = cleanedData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          dstPixels[dstIdx] = srcPixels[dstIdx];
          dstPixels[dstIdx + 1] = srcPixels[dstIdx + 1];
          dstPixels[dstIdx + 2] = srcPixels[dstIdx + 2];
          dstPixels[dstIdx + 3] = 255;
          continue;
        }

        let blackCount = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nIdx = ((y + ky) * width + (x + kx)) * 4;
            if (srcPixels[nIdx] < 128) {
              blackCount++;
            }
          }
        }

        let val = srcPixels[dstIdx];
        if (srcPixels[dstIdx] < 128 && blackCount <= 2) {
          val = 255; // Eliminate speckle
        } else if (srcPixels[dstIdx] > 128 && blackCount >= 7) {
          val = 0; // Fill small pixel gaps
        }

        dstPixels[dstIdx] = val;
        dstPixels[dstIdx + 1] = val;
        dstPixels[dstIdx + 2] = val;
        dstPixels[dstIdx + 3] = 255;
      }
    }
    destCtx.putImageData(cleanedData, 0, 0);
  }

  // 4. Sharpen Filter
  if (options.sharpen && width > 2 && height > 2) {
    const srcData = destCtx.getImageData(0, 0, width, height);
    const srcPixels = srcData.data;
    const sharpenedData = destCtx.createImageData(width, height);
    const dstPixels = sharpenedData.data;

    const weights = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let rSum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const scIdx = ((y + ky) * width + (x + kx)) * 4;
            const w = weights[(ky + 1) * 3 + (kx + 1)];
            rSum += srcPixels[scIdx] * w;
          }
        }
        rSum = Math.max(0, Math.min(255, rSum));
        const dstIdx = (y * width + x) * 4;
        dstPixels[dstIdx] = rSum;
        dstPixels[dstIdx + 1] = rSum;
        dstPixels[dstIdx + 2] = rSum;
        dstPixels[dstIdx + 3] = 255;
      }
    }
    destCtx.putImageData(sharpenedData, 0, 0);
  }
}

/**
 * Creates multiple variants of a source canvas for multi-pass OCR.
 * Pass 1: Standard high-contrast binarized
 * Pass 2: Adaptive threshold with noise reduction
 * Pass 3: Grayscale boost (non-binarized)
 * Pass 4: Inverted dark mode
 */
export function createMultiPassVariants(srcCanvas: HTMLCanvasElement): { name: string; canvas: HTMLCanvasElement }[] {
  const width = srcCanvas.width;
  const height = srcCanvas.height;

  if (width === 0 || height === 0) return [];

  const createVariant = (name: string, opts: PreprocessingOptions) => {
    const c = document.createElement('canvas');
    preprocessImage(srcCanvas, c, opts);
    return { name, canvas: c };
  };

  return [
    createVariant('pass1_standard', { contrast: 75, brightness: 10, binarizeThreshold: 128, sharpen: true, noiseRemoval: false }),
    createVariant('pass2_adaptive', { contrast: 85, brightness: 5, binarizeThreshold: 135, sharpen: true, noiseRemoval: true, adaptiveThreshold: true }),
    createVariant('pass3_grayscale', { contrast: 80, brightness: 15, sharpen: true }), // smooth edges for fine print
    createVariant('pass4_inverted', { contrast: 70, brightness: 10, binarizeThreshold: 128, sharpen: true, invert: true })
  ];
}
