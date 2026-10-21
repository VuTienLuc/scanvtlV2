import type { Point, QuadCorners, FilterType } from '../types/scanner';

declare global {
  interface Window {
    cv: any;
    cvLoaded?: boolean;
  }
}

/**
 * Calculates Euclidean distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Orders 4 arbitrary points into: [topLeft, topRight, bottomRight, bottomLeft]
 */
export function orderCorners(points: Point[]): QuadCorners {
  if (points.length !== 4) {
    throw new Error('Cần chính xác 4 điểm để sắp xếp góc');
  }

  // Sort by (x + y) to find topLeft (min) and bottomRight (max)
  const sumSorted = [...points].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const topLeft = sumSorted[0];
  const bottomRight = sumSorted[3];

  // Sort by (y - x) to find topRight (min y - x) and bottomLeft (max y - x)
  const diffSorted = [...points].sort((a, b) => (a.y - a.x) - (b.y - b.x));
  const topRight = diffSorted[0];
  const bottomLeft = diffSorted[3];

  return { topLeft, topRight, bottomRight, bottomLeft };
}

/**
 * Calculates default crop corners based on standard A4 aspect ratio in image center
 */
export function getDefaultCorners(width: number, height: number, marginPercent = 0.08): QuadCorners {
  const mx = width * marginPercent;
  const my = height * marginPercent;

  return {
    topLeft: { x: mx, y: my },
    topRight: { x: width - mx, y: my },
    bottomRight: { x: width - mx, y: height - my },
    bottomLeft: { x: mx, y: height - my }
  };
}

/**
 * OpenCV loader with dynamic script injection and timeout protection
 */
let openCvPromise: Promise<boolean> | null = null;

export async function loadOpenCV(): Promise<boolean> {
  if (window.cv && window.cv.Mat) {
    return true;
  }

  if (openCvPromise) {
    return openCvPromise;
  }

  openCvPromise = new Promise((resolve) => {
    // If already in DOM
    const existing = document.getElementById('opencv-script') as HTMLScriptElement;
    if (existing && window.cv && window.cv.Mat) {
      resolve(true);
      return;
    }

    const script = existing || document.createElement('script');
    script.id = 'opencv-script';
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.type = 'text/javascript';

    const timeout = setTimeout(() => {
      console.warn('OpenCV load timeout - will use pure JS fallback');
      resolve(false);
    }, 12000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.cv) {
        window.cv.onRuntimeInitialized = () => {
          window.cvLoaded = true;
          resolve(true);
        };
        // Some builds of opencv.js already initialized
        if (window.cv.Mat) {
          window.cvLoaded = true;
          resolve(true);
        }
      } else {
        resolve(false);
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      console.warn('Không thể nạp OpenCV.js từ CDN, chuyển sang thuật toán JS thuần.');
      resolve(false);
    };

    if (!existing) {
      document.body.appendChild(script);
    }
  });

  return openCvPromise;
}

/**
 * Detects document corners in an image using OpenCV or smart edge heuristics
 */
export async function detectDocumentCorners(
  sourceCanvas: HTMLCanvasElement
): Promise<QuadCorners> {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const fallback = getDefaultCorners(width, height);

  const hasCv = await loadOpenCV();
  if (!hasCv || !window.cv || !window.cv.Mat) {
    return fallback;
  }

  const cv = window.cv;
  let src: any = null;
  let gray: any = null;
  let blur: any = null;
  let edges: any = null;
  let contours: any = null;
  let hierarchy: any = null;

  try {
    // Downscale for fast contour detection
    const scale = Math.min(1, 600 / Math.max(width, height));
    const smallW = Math.round(width * scale);
    const smallH = Math.round(height * scale);

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallW;
    smallCanvas.height = smallH;
    const sctx = smallCanvas.getContext('2d');
    if (!sctx) return fallback;
    sctx.drawImage(sourceCanvas, 0, 0, smallW, smallH);

    src = cv.imread(smallCanvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    blur = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blur, ksize, 0, 0, cv.BORDER_DEFAULT);

    edges = new cv.Mat();
    cv.Canny(blur, edges, 50, 150, 3, false);

    // Dilate edges to close gaps
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, edges, kernel);
    kernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestPoly: Point[] | null = null;
    const minArea = (smallW * smallH) * 0.12; // Must be at least 12% of frame

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area > minArea && area > maxArea) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);

        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          maxArea = area;
          bestPoly = [];
          for (let r = 0; r < 4; r++) {
            bestPoly.push({
              x: (approx.data32S[r * 2] / scale),
              y: (approx.data32S[r * 2 + 1] / scale)
            });
          }
        }
        approx.delete();
      }
      contour.delete();
    }

    if (bestPoly && bestPoly.length === 4) {
      return orderCorners(bestPoly);
    }

    return fallback;
  } catch (err) {
    console.error('Lỗi khi phát hiện góc bằng OpenCV:', err);
    return fallback;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (blur) blur.delete();
    if (edges) edges.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Computes destination dimensions and performs 4-point perspective transform.
 */
export async function applyPerspectiveWarp(
  sourceCanvas: HTMLCanvasElement,
  corners: QuadCorners
): Promise<HTMLCanvasElement> {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  // Calculate target dimensions
  const topWidth = distance(topLeft, topRight);
  const bottomWidth = distance(bottomLeft, bottomRight);
  const targetWidth = Math.round(Math.max(topWidth, bottomWidth));

  const leftHeight = distance(topLeft, bottomLeft);
  const rightHeight = distance(topRight, bottomRight);
  const targetHeight = Math.round(Math.max(leftHeight, rightHeight));

  // Cap dimensions to avoid mobile OOM (max 2600px)
  const maxDim = 2600;
  const factor = Math.min(1, maxDim / Math.max(targetWidth, targetHeight));
  const finalW = Math.max(200, Math.round(targetWidth * factor));
  const finalH = Math.max(200, Math.round(targetHeight * factor));

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = finalW;
  outputCanvas.height = finalH;

  const hasCv = await loadOpenCV();
  if (hasCv && window.cv && window.cv.Mat) {
    const cv = window.cv;
    let srcMat: any = null;
    let dstMat: any = null;
    let M: any = null;
    let srcTri: any = null;
    let dstTri: any = null;

    try {
      srcMat = cv.imread(sourceCanvas);
      dstMat = new cv.Mat();

      srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        topLeft.x, topLeft.y,
        topRight.x, topRight.y,
        bottomRight.x, bottomRight.y,
        bottomLeft.x, bottomLeft.y
      ]);

      dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        finalW, 0,
        finalW, finalH,
        0, finalH
      ]);

      M = cv.getPerspectiveTransform(srcTri, dstTri);
      const dsize = new cv.Size(finalW, finalH);
      cv.warpPerspective(srcMat, dstMat, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      cv.imshow(outputCanvas, dstMat);
      return outputCanvas;
    } catch (e) {
      console.warn('OpenCV warp perspective error, fallback to JS matrix:', e);
    } finally {
      if (srcMat) srcMat.delete();
      if (dstMat) dstMat.delete();
      if (M) M.delete();
      if (srcTri) srcTri.delete();
      if (dstTri) dstTri.delete();
    }
  }

  // Pure JavaScript fallback for perspective transform using canvas slicing
  return applyJsPerspectiveFallback(sourceCanvas, corners, finalW, finalH);
}

/**
 * Pure TypeScript fallback for perspective warp
 */
function applyJsPerspectiveFallback(
  sourceCanvas: HTMLCanvasElement,
  corners: QuadCorners,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = targetWidth;
  result.height = targetHeight;
  const ctx = result.getContext('2d');
  if (!ctx) return result;

  // Approximate using mesh triangle decomposition on 2D canvas
  const sCtx = sourceCanvas.getContext('2d');
  if (!sCtx) return result;

  const srcImgData = sCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const dstImgData = ctx.createImageData(targetWidth, targetHeight);

  // Compute Homography H from src to dst: we need H_inv to map (x_dst, y_dst) -> (x_src, y_src)
  const Hinv = getPerspectiveHomography(
    [0, 0, targetWidth, 0, targetWidth, targetHeight, 0, targetHeight],
    [corners.topLeft.x, corners.topLeft.y, corners.topRight.x, corners.topRight.y, corners.bottomRight.x, corners.bottomRight.y, corners.bottomLeft.x, corners.bottomLeft.y]
  );

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcData = srcImgData.data;
  const dstData = dstImgData.data;

  for (let dy = 0; dy < targetHeight; dy++) {
    for (let dx = 0; dx < targetWidth; dx++) {
      const denom = Hinv[6] * dx + Hinv[7] * dy + Hinv[8];
      const sx = (Hinv[0] * dx + Hinv[1] * dy + Hinv[2]) / denom;
      const sy = (Hinv[3] * dx + Hinv[4] * dy + Hinv[5]) / denom;

      const isx = Math.round(sx);
      const isy = Math.round(sy);

      if (isx >= 0 && isx < srcW && isy >= 0 && isy < srcH) {
        const srcIdx = (isy * srcW + isx) * 4;
        const dstIdx = (dy * targetWidth + dx) * 4;
        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(dstImgData, 0, 0);
  return result;
}

/**
 * Solves 8x8 linear system to find 3x3 homography matrix
 */
export function getPerspectiveHomography(src: number[], dst: number[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i * 2];
    const sy = src[i * 2 + 1];
    const dx = dst[i * 2];
    const dy = dst[i * 2 + 1];

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Gaussian elimination to solve A * h = b
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    const tempA = A[i];
    A[i] = A[maxRow];
    A[maxRow] = tempA;
    const tempB = b[i];
    b[i] = b[maxRow];
    b[maxRow] = tempB;

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      b[k] -= factor * b[i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
    }
  }

  const h = new Array(9).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * h[j];
    }
    h[i] = (b[i] - sum) / A[i][i];
  }
  h[8] = 1;
  return h;
}

/**
 * Applies document filters: original, enhanced, grayscale, bw, clean (adaptive threshold)
 */
export async function applyImageFilter(
  canvas: HTMLCanvasElement,
  filter: FilterType
): Promise<HTMLCanvasElement> {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext('2d');
  if (!ctx) return canvas;

  if (filter === 'original') {
    ctx.drawImage(canvas, 0, 0);
    return output;
  }

  // Enhanced Filter: Color contrast boost, vibrant text
  if (filter === 'enhanced') {
    ctx.filter = 'contrast(135%) brightness(108%) saturate(125%)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    return output;
  }

  // Grayscale Filter
  if (filter === 'grayscale') {
    ctx.filter = 'grayscale(100%) contrast(140%) brightness(110%)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    return output;
  }

  // High contrast Black & White
  if (filter === 'bw') {
    ctx.filter = 'grayscale(100%) contrast(240%) brightness(115%)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    return output;
  }

  // Clean Filter: Adaptive threshold (clean paper, dark crisp ink)
  if (filter === 'clean') {
    const hasCv = await loadOpenCV();
    if (hasCv && window.cv && window.cv.Mat) {
      const cv = window.cv;
      let src: any = null;
      let gray: any = null;
      let thresh: any = null;
      try {
        src = cv.imread(canvas);
        gray = new cv.Mat();
        thresh = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        // Adaptive threshold
        cv.adaptiveThreshold(
          gray,
          thresh,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          25,
          15
        );
        cv.imshow(output, thresh);
        return output;
      } catch (err) {
        console.warn('OpenCV adaptive threshold error, fallback to JS clean filter:', err);
      } finally {
        if (src) src.delete();
        if (gray) gray.delete();
        if (thresh) thresh.delete();
      }
    }

    // Pure JS Bradley-Roth adaptive thresholding fallback
    return applyJsAdaptiveThreshold(canvas);
  }

  ctx.drawImage(canvas, 0, 0);
  return output;
}

/**
 * Pure JS Integral Image Adaptive Thresholding (Bradley-Roth algorithm)
 */
export function applyJsAdaptiveThreshold(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = canvas.width;
  result.height = canvas.height;
  const ctx = result.getContext('2d');
  if (!ctx) return canvas;

  const srcCtx = canvas.getContext('2d');
  if (!srcCtx) return canvas;

  const imgData = srcCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Convert to grayscale & create integral image
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  const integral = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      if (y === 0) {
        integral[x] = rowSum;
      } else {
        integral[y * w + x] = integral[(y - 1) * w + x] + rowSum;
      }
    }
  }

  const S = Math.round(w / 16);
  const s2 = Math.round(S / 2);
  const T = 0.15; // 15% darker than local mean

  const outData = ctx.createImageData(w, h);
  const out = outData.data;

  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - s2);
    const y2 = Math.min(h - 1, y + s2);

    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(w - 1, x + s2);

      const count = (x2 - x1) * (y2 - y1);
      const sum = integral[y2 * w + x2]
        - integral[y1 * w + x2]
        - integral[y2 * w + x1]
        + integral[y1 * w + x1];

      const idx = y * w + x;
      const pixel = gray[idx];
      const outIdx = idx * 4;

      if (pixel * count < sum * (1.0 - T)) {
        // Text ink (black)
        out[outIdx] = 15;
        out[outIdx + 1] = 15;
        out[outIdx + 2] = 15;
      } else {
        // Clean paper background (white)
        out[outIdx] = 255;
        out[outIdx + 1] = 255;
        out[outIdx + 2] = 255;
      }
      out[outIdx + 3] = 255;
    }
  }

  ctx.putImageData(outData, 0, 0);
  return result;
}

/**
 * Splits a two-page book image into Left and Right canvases based on spine X percentage
 */
export function splitBookPages(
  sourceCanvas: HTMLCanvasElement,
  spineRatio = 0.5
): { leftCanvas: HTMLCanvasElement; rightCanvas: HTMLCanvasElement } {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const spineX = Math.round(w * spineRatio);

  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = spineX;
  leftCanvas.height = h;
  const lctx = leftCanvas.getContext('2d');
  if (lctx) {
    lctx.drawImage(sourceCanvas, 0, 0, spineX, h, 0, 0, spineX, h);
  }

  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = w - spineX;
  rightCanvas.height = h;
  const rctx = rightCanvas.getContext('2d');
  if (rctx) {
    rctx.drawImage(sourceCanvas, spineX, 0, w - spineX, h, 0, 0, w - spineX, h);
  }

  return { leftCanvas, rightCanvas };
}

/**
 * Rotates a canvas by 90, 180, or 270 degrees clockwise
 */
export function rotateCanvas(canvas: HTMLCanvasElement, rotation: 0 | 90 | 180 | 270): HTMLCanvasElement {
  if (rotation === 0) return canvas;

  const rotated = document.createElement('canvas');
  const ctx = rotated.getContext('2d');
  if (!ctx) return canvas;

  if (rotation === 90 || rotation === 270) {
    rotated.width = canvas.height;
    rotated.height = canvas.width;
  } else {
    rotated.width = canvas.width;
    rotated.height = canvas.height;
  }

  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return rotated;
}

/**
 * Creates low-res thumbnail for fast UI rendering
 */
export function generateThumbnail(canvas: HTMLCanvasElement, maxDimension = 240): string {
  const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height));
  const thumbW = Math.round(canvas.width * scale);
  const thumbH = Math.round(canvas.height * scale);

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const ctx = thumbCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
  }
  return thumbCanvas.toDataURL('image/jpeg', 0.65);
}

/**
 * Creates low-res thumbnail directly from dataURL
 */
export async function generateThumbnailFromDataUrl(dataUrl: string, maxDim = 240): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
