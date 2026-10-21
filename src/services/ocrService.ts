import { createWorker, type Worker } from 'tesseract.js';
import type { OCRData, OCRLine, OCRWord } from '../types/scanner';

export interface OCRProgressCallback {
  (progress: number, status: string): void;
}

export class OCRService {
  private worker: Worker | null = null;
  private currentLanguage = '';
  private isInitializing = false;

  /**
   * Initializes or reuses the Tesseract.js worker with specified language.
   */
  async getWorker(lang = 'vie+eng', onProgress?: OCRProgressCallback): Promise<Worker> {
    if (this.worker && this.currentLanguage === lang) {
      return this.worker;
    }

    if (this.worker && this.currentLanguage !== lang) {
      await this.worker.terminate();
      this.worker = null;
    }

    if (this.isInitializing) {
      // Wait for ongoing initialization
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.worker) return this.worker;
    }

    this.isInitializing = true;
    try {
      if (onProgress) onProgress(5, 'Đang tải mô hình nhận diện AI...');

      const worker = await createWorker(lang, 1, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            const pct = Math.round(10 + m.progress * 85);
            onProgress(pct, `Đang nhận diện chữ (${pct}%)...`);
          } else if (onProgress && m.status) {
            onProgress(10, `Đang tải tài nguyên (${m.status})...`);
          }
        }
      });

      this.worker = worker;
      this.currentLanguage = lang;
      return worker;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Recognizes text from image with detailed word & line bounding boxes.
   */
  async recognizeImage(
    imageDataUrl: string,
    lang = 'vie+eng',
    onProgress?: OCRProgressCallback
  ): Promise<OCRData> {
    const worker = await this.getWorker(lang, onProgress);

    if (onProgress) onProgress(15, 'Bắt đầu phân tích văn bản...');
    const result = await worker.recognize(imageDataUrl);

    const lines: OCRLine[] = [];

    // Extract detailed bounding boxes if available in tesseract response
    const blocks = (result.data as any).blocks || [];
    for (const block of blocks) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          const words: OCRWord[] = [];
          for (const word of line.words || []) {
            words.push({
              text: word.text,
              confidence: word.confidence,
              bbox: {
                x0: word.bbox.x0,
                y0: word.bbox.y0,
                x1: word.bbox.x1,
                y1: word.bbox.y1
              }
            });
          }

          lines.push({
            text: line.text,
            confidence: line.confidence,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1
            },
            words
          });
        }
      }
    }

    if (onProgress) onProgress(100, 'Đã nhận diện xong!');

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      lines,
      language: lang,
      processedAt: Date.now()
    };
  }

  /**
   * Terminates worker to release memory when idle or on app unload.
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.currentLanguage = '';
    }
  }
}

export const ocrService = new OCRService();
