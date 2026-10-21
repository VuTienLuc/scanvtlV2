import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import type { PageRecord, PDFExportOptions } from '../types/scanner';

export interface PDFDimension {
  width: number;
  height: number;
}

export const PAGE_SIZES: Record<'a4' | 'a5' | 'letter', PDFDimension> = {
  a4: { width: 595.28, height: 841.89 },
  a5: { width: 419.53, height: 595.28 },
  letter: { width: 612.0, height: 792.0 }
};

/**
 * Converts mm to PDF points (1 inch = 25.4 mm = 72 points)
 */
export function mmToPoints(mm: number): number {
  return (mm / 25.4) * 72;
}

/**
 * Compresses an image dataURL using an offscreen canvas and real JPEG quality parameter.
 */
export async function compressImageDataUrl(dataUrl: string, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo 2D context để nén ảnh'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Lỗi chuyển đổi ảnh sang blob'));
            return;
          }
          const arrayBuffer = await blob.arrayBuffer();
          resolve(new Uint8Array(arrayBuffer));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = (e) => reject(new Error('Không thể tải ảnh để nén: ' + e));
    img.src = dataUrl;
  });
}

export class PDFService {
  /**
   * Generates a multi-page PDF document with real compression and optional searchable text layer.
   */
  async generatePDF(
    pages: PageRecord[],
    options: PDFExportOptions,
    onProgress?: (progress: number, statusText: string) => void
  ): Promise<Uint8Array> {
    if (pages.length === 0) {
      throw new Error('Danh sách trang trống, không thể tạo PDF.');
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(options.filename.replace(/\.pdf$/i, ''));
    pdfDoc.setCreator('Scanner Pro EDU');
    pdfDoc.setProducer('pdf-lib (Scanner Pro EDU PWA)');
    pdfDoc.setCreationDate(new Date());

    const baseDim = PAGE_SIZES[options.pageSize] || PAGE_SIZES.a4;
    const marginPts = mmToPoints(options.marginMm);

    let font: any = null;
    if (options.includeSearchableText) {
      try {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      } catch (e) {
        console.warn('Không thể embed Helvetica font cho OCR layer:', e);
      }
    }

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (onProgress) {
        onProgress(Math.round(((i + 0.1) / pages.length) * 100), `Đang nén trang ${i + 1}/${pages.length}...`);
      }

      // Step 1: Real compression using canvas toBlob with selected quality
      const compressedImageBytes = await compressImageDataUrl(page.processedImage, options.quality);

      if (onProgress) {
        onProgress(Math.round(((i + 0.5) / pages.length) * 100), `Đang nhúng trang ${i + 1}/${pages.length}...`);
      }

      const embeddedImage = await pdfDoc.embedJpg(compressedImageBytes);
      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      // Determine page orientation
      let targetWidth = baseDim.width;
      let targetHeight = baseDim.height;

      if (options.orientation === 'landscape') {
        targetWidth = Math.max(baseDim.width, baseDim.height);
        targetHeight = Math.min(baseDim.width, baseDim.height);
      } else if (options.orientation === 'portrait') {
        targetWidth = Math.min(baseDim.width, baseDim.height);
        targetHeight = Math.max(baseDim.width, baseDim.height);
      } else {
        // 'auto' mode: match image aspect ratio
        if (imgWidth > imgHeight) {
          targetWidth = Math.max(baseDim.width, baseDim.height);
          targetHeight = Math.min(baseDim.width, baseDim.height);
        } else {
          targetWidth = Math.min(baseDim.width, baseDim.height);
          targetHeight = Math.max(baseDim.width, baseDim.height);
        }
      }

      const pdfPage = pdfDoc.addPage([targetWidth, targetHeight]);

      // Calculate fitted bounds within margins
      const availableWidth = targetWidth - marginPts * 2;
      const availableHeight = targetHeight - marginPts * 2;

      const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      const posX = marginPts + (availableWidth - drawWidth) / 2;
      const posY = marginPts + (availableHeight - drawHeight) / 2;

      // Draw document image
      pdfPage.drawImage(embeddedImage, {
        x: posX,
        y: posY,
        width: drawWidth,
        height: drawHeight
      });

      // Step 2: Searchable PDF Text Layer (Invisible text at exact word coordinates)
      if (options.includeSearchableText && font && page.ocrData && page.ocrData.lines) {
        const scaleX = drawWidth / (page.width || imgWidth);
        const scaleY = drawHeight / (page.height || imgHeight);

        for (const line of page.ocrData.lines) {
          if (!line.text || !line.bbox) continue;

          for (const word of line.words || []) {
            if (!word.text.trim()) continue;

            const wordX = posX + word.bbox.x0 * scaleX;
            // PDF origin (0,0) is bottom-left, whereas canvas (0,0) is top-left
            const wordY = posY + drawHeight - (word.bbox.y1 * scaleY);
            const wordBoxH = Math.max(6, (word.bbox.y1 - word.bbox.y0) * scaleY);

            const fontSize = Math.max(4, Math.min(18, wordBoxH * 0.9));

            try {
              // Sanitize non-ASCII chars for standard Helvetica font to prevent pdf-lib encoding crash
              const safeText = word.text.replace(/[^\x20-\x7E]/g, ' ');
              if (safeText.trim()) {
                pdfPage.drawText(safeText, {
                  x: wordX,
                  y: wordY,
                  size: fontSize,
                  font,
                  color: rgb(0, 0, 0),
                  opacity: 0 // Invisible layer for selection and search
                });
              }
            } catch {
              // Ignore single word drawing error
            }
          }
        }
      }
    }

    if (onProgress) {
      onProgress(95, 'Đang xuất tệp PDF...');
    }

    const pdfBytes = await pdfDoc.save();

    if (onProgress) {
      onProgress(100, 'Hoàn thành!');
    }

    return pdfBytes;
  }

  /**
   * Merges multiple PDF Uint8Arrays into a single document.
   */
  async mergePDFs(pdfByteArrays: Uint8Array[]): Promise<Uint8Array> {
    if (pdfByteArrays.length < 2) {
      throw new Error('Cần ít nhất 2 tệp PDF để gộp.');
    }

    const mergedDoc = await PDFDocument.create();

    for (const bytes of pdfByteArrays) {
      const srcDoc = await PDFDocument.load(bytes);
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    return await mergedDoc.save();
  }

  /**
   * Splits a PDF document by extracting specified 0-based page indices.
   */
  async splitPDF(pdfBytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(pdfBytes);
    const splitDoc = await PDFDocument.create();

    const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < srcDoc.getPageCount());
    if (validIndices.length === 0) {
      throw new Error('Không có trang nào hợp lệ để tách.');
    }

    const copiedPages = await splitDoc.copyPages(srcDoc, validIndices);
    copiedPages.forEach((page) => splitDoc.addPage(page));

    return await splitDoc.save();
  }

  /**
   * Rotates specific pages in a PDF document by rotation angle.
   */
  async rotatePDFPages(pdfBytes: Uint8Array, pageIndices: number[], angleDegrees: 90 | 180 | 270): Promise<Uint8Array> {
    const doc = await PDFDocument.load(pdfBytes);
    const pages = doc.getPages();

    for (const idx of pageIndices) {
      if (idx >= 0 && idx < pages.length) {
        const page = pages[idx];
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + angleDegrees) % 360));
      }
    }

    return await doc.save();
  }

  /**
   * Generates a PDF in ultra-fast mode (< 1s) directly from page buffers without re-rendering canvases.
   */
  async generateFastPDF(
    pages: PageRecord[],
    customFilename?: string,
    onProgress?: (progress: number, statusText: string) => void,
    pageSize: 'a4' | 'a5' = 'a4'
  ): Promise<{ pdfBytes: Uint8Array; filename: string }> {
    if (pages.length === 0) {
      throw new Error('Danh sách trang trống, không thể tạo PDF.');
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const filename = customFilename || `TaiLieu_QuetNhanh_${pageSize.toUpperCase()}_${dateStr}.pdf`;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(filename.replace(/\.pdf$/i, ''));
    pdfDoc.setCreator('Scanner Pro EDU');

    const pageDim = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (onProgress) {
        onProgress(Math.round(((i + 1) / pages.length) * 90), `Đang nạp trang ${i + 1}/${pages.length}...`);
      }

      // Fast binary extraction if data is already JPEG/PNG dataURL
      let imageBytes: Uint8Array;
      if (page.processedImage.startsWith('data:image/jpeg') || page.processedImage.startsWith('data:image/jpg')) {
        imageBytes = fastDataUrlToBytes(page.processedImage);
      } else {
        imageBytes = await compressImageDataUrl(page.processedImage, 0.8);
      }

      const embeddedImage = await pdfDoc.embedJpg(imageBytes);
      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      // Auto orientation based on aspect ratio
      const isLandscape = imgWidth > imgHeight;
      const targetWidth = isLandscape ? pageDim.height : pageDim.width;
      const targetHeight = isLandscape ? pageDim.width : pageDim.height;

      const pdfPage = pdfDoc.addPage([targetWidth, targetHeight]);

      const scale = Math.min(targetWidth / imgWidth, targetHeight / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const posX = (targetWidth - drawWidth) / 2;
      const posY = (targetHeight - drawHeight) / 2;

      pdfPage.drawImage(embeddedImage, {
        x: posX,
        y: posY,
        width: drawWidth,
        height: drawHeight
      });
    }

    if (onProgress) onProgress(98, 'Đang xuất tệp PDF...');
    const pdfBytes = await pdfDoc.save();
    if (onProgress) onProgress(100, 'Hoàn tất!');

    return { pdfBytes, filename };
  }
}

/**
 * Rapid base64 to Uint8Array converter bypassing canvas overhead
 */
export function fastDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const pdfService = new PDFService();
