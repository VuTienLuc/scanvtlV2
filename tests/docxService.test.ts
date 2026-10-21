import { describe, it, expect } from 'vitest';
import { docxService } from '../src/services/docxService';
import type { PageRecord, DOCXExportOptions } from '../src/types/scanner';

describe('docxService - Word Document Export Tests', () => {
  // 1x1 transparent dummy png dataUrl for testing
  const dummyImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const mockPages: PageRecord[] = [
    {
      id: 'p1',
      captureId: 'c1',
      sourceImage: dummyImg,
      processedImage: dummyImg,
      thumbnail: dummyImg,
      rotation: 0,
      filter: 'scan' as any,
      annotations: [],
      status: 'committed',
      pageNumber: 1,
      width: 1000,
      height: 1414,
      ocrData: {
        text: 'Cộng hòa Xã hội Chủ nghĩa Việt Nam\n\nĐộc lập - Tự do - Hạnh phúc',
        confidence: 95,
        lines: [],
        language: 'vie',
        processedAt: Date.now()
      },
      mathFormulas: [
        {
          id: 'm1',
          latex: 'E = mc^2',
          status: 'verified',
          box: { x: 0, y: 0, width: 100, height: 50 }
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  it('generates an image-based Word document blob', async () => {
    const options: DOCXExportOptions = {
      mode: 'image-based',
      filename: 'TestDocImage.docx',
      includeMathOMML: false,
      includeOriginalPageNumber: true
    };

    const blob = await docxService.generateDocx(mockPages, options);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('generates an editable Word document blob with text and math equations', async () => {
    const options: DOCXExportOptions = {
      mode: 'editable',
      filename: 'TestDocEditable.docx',
      includeMathOMML: true,
      includeOriginalPageNumber: true
    };

    const blob = await docxService.generateDocx(mockPages, options);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});
