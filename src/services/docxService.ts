import {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  PageBreak,
  Math as DocxMath,
  MathRun
} from 'docx';
import type { PageRecord, DOCXExportOptions } from '../types/scanner';

/**
 * Converts a base64 dataURL to Uint8Array buffer
 */
export async function dataUrlToBuffer(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export class DocxService {
  /**
   * Generates a Word (.docx) document in either Image-Based or Editable mode.
   */
  async generateDocx(
    pages: PageRecord[],
    options: DOCXExportOptions,
    onProgress?: (pct: number, msg: string) => void
  ): Promise<Blob> {
    if (pages.length === 0) {
      throw new Error('Không có trang nào để xuất Word.');
    }

    if (onProgress) onProgress(10, 'Đang chuẩn bị dữ liệu Word...');

    if (options.mode === 'image-based') {
      return await this.generateImageBasedDocx(pages, options, onProgress);
    } else {
      return await this.generateEditableDocx(pages, options, onProgress);
    }
  }

  /**
   * Mode A: Image-Based DOCX
   * Inserts scanned pages as full-width high-resolution images.
   */
  private async generateImageBasedDocx(
    pages: PageRecord[],
    options: DOCXExportOptions,
    onProgress?: (pct: number, msg: string) => void
  ): Promise<Blob> {
    const children: Paragraph[] = [];

    // Title / Header notice
    children.push(
      new Paragraph({
        text: options.filename.replace(/\.docx$/i, ''),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Tài liệu xuất dạng ảnh quét (Bảo toàn 100% hình thức - không chỉnh sửa trực tiếp text).',
            italics: true,
            color: '666666',
            size: 20
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      })
    );

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (onProgress) {
        onProgress(
          Math.round(20 + ((i + 1) / pages.length) * 60),
          `Đang xử lý trang ${i + 1}/${pages.length}...`
        );
      }

      const imgBuffer = await dataUrlToBuffer(page.processedImage);

      // A4 page width printable is approx 580px
      const imgWidth = 560;
      const aspect = (page.height || 1414) / (page.width || 1000);
      const imgHeight = Math.min(780, Math.round(imgWidth * aspect));

      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imgBuffer,
              transformation: {
                width: imgWidth,
                height: imgHeight
              },
              type: 'jpg'
            } as any)
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      );

      if (options.includeOriginalPageNumber) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `— Trang ${i + 1} —`,
                size: 18,
                color: '888888'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
          })
        );
      }

      if (i < pages.length - 1) {
        children.push(
          new Paragraph({
            children: [new PageBreak()]
          })
        );
      }
    }

    if (onProgress) onProgress(85, 'Đang đóng gói file Word (.docx)...');

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720, // 0.5 inch
                right: 720,
                bottom: 720,
                left: 720
              }
            }
          },
          children
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    if (onProgress) onProgress(100, 'Đã xuất Word thành công!');
    return blob;
  }

  /**
   * Mode B: Editable DOCX
   * Reconstructs text paragraphs from OCR, converts LaTeX equations into Word Math equations.
   */
  private async generateEditableDocx(
    pages: PageRecord[],
    options: DOCXExportOptions,
    onProgress?: (pct: number, msg: string) => void
  ): Promise<Blob> {
    const children: Paragraph[] = [];

    // Header title
    children.push(
      new Paragraph({
        text: options.filename.replace(/\.docx$/i, ''),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Tài liệu chuyển đổi OCR có thể chỉnh sửa văn bản. (Lưu ý: Bố cục phức tạp hoặc công thức đặc biệt có thể cần rà soát lại).',
            italics: true,
            color: '666666',
            size: 18
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      })
    );

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (onProgress) {
        onProgress(
          Math.round(20 + ((i + 1) / pages.length) * 60),
          `Đang chuyển đổi nội dung trang ${i + 1}/${pages.length}...`
        );
      }

      // Page separator
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `=== NỘI DUNG TRANG ${i + 1} ===`,
              bold: true,
              color: '2563EB',
              size: 22
            })
          ],
          spacing: { before: 200, after: 150 }
        })
      );

      // If OCR text is available, split by lines/paragraphs
      if (page.ocrData && page.ocrData.text.trim()) {
        const paragraphs = page.ocrData.text.split('\n\n');
        for (const pText of paragraphs) {
          const trimmed = pText.trim();
          if (!trimmed) continue;

          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmed,
                  size: 24
                })
              ],
              spacing: { after: 120 }
            })
          );
        }
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '(Trang này chưa được nhận diện OCR chữ. Bạn có thể dùng tính năng OCR để trích xuất văn bản).',
                italics: true,
                color: '999999',
                size: 20
              })
            ],
            spacing: { after: 150 }
          })
        );
      }

      // Add Math equations detected or verified on this page
      if (options.includeMathOMML && page.mathFormulas && page.mathFormulas.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Công thức Toán học:',
                bold: true,
                color: '059669',
                size: 20
              })
            ],
            spacing: { before: 150, after: 100 }
          })
        );

        for (const formula of page.mathFormulas) {
          children.push(
            new Paragraph({
              children: [
                new DocxMath({
                  children: [new MathRun(formula.latex)]
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 }
            })
          );
        }
      }

      if (i < pages.length - 1) {
        children.push(
          new Paragraph({
            children: [new PageBreak()]
          })
        );
      }
    }

    if (onProgress) onProgress(85, 'Đang đóng gói file Word (.docx)...');

    const doc = new Document({
      sections: [
        {
          children
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    if (onProgress) onProgress(100, 'Đã xuất Word thành công!');
    return blob;
  }
}

export const docxService = new DocxService();
