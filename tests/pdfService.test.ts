import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pdfService, PAGE_SIZES, mmToPoints } from '../src/services/pdfService';

describe('pdfService - PDF Engine Tests', () => {
  it('converts mm to points accurately', () => {
    expect(mmToPoints(25.4)).toBeCloseTo(72, 2);
    expect(mmToPoints(0)).toBe(0);
    expect(mmToPoints(10)).toBeCloseTo(28.346, 2);
  });

  it('defines correct standard dimensions for A4, A5, and Letter', () => {
    expect(PAGE_SIZES.a4.width).toBeCloseTo(595.28, 1);
    expect(PAGE_SIZES.a4.height).toBeCloseTo(841.89, 1);
    expect(PAGE_SIZES.letter.width).toBe(612);
    expect(PAGE_SIZES.letter.height).toBe(792);
  });

  it('merges multiple PDF documents into one', async () => {
    // Create 2 test dummy PDFs
    const doc1 = await PDFDocument.create();
    doc1.addPage([595, 842]);
    const pdf1Bytes = await doc1.save();

    const doc2 = await PDFDocument.create();
    doc2.addPage([595, 842]);
    doc2.addPage([595, 842]);
    const pdf2Bytes = await doc2.save();

    // Merge them
    const mergedBytes = await pdfService.mergePDFs([pdf1Bytes, pdf2Bytes]);
    const mergedDoc = await PDFDocument.load(mergedBytes);

    expect(mergedDoc.getPageCount()).toBe(3);
  });

  it('splits a PDF document by specified page indices', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]); // Page 0
    doc.addPage([595, 842]); // Page 1
    doc.addPage([595, 842]); // Page 2
    const originalBytes = await doc.save();

    const splitBytes = await pdfService.splitPDF(originalBytes, [1]);
    const splitDoc = await PDFDocument.load(splitBytes);

    expect(splitDoc.getPageCount()).toBe(1);
  });

  it('rotates pages in a PDF document', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const originalBytes = await doc.save();

    const rotatedBytes = await pdfService.rotatePDFPages(originalBytes, [0], 90);
    const rotatedDoc = await PDFDocument.load(rotatedBytes);

    expect(rotatedDoc.getPage(0).getRotation().angle).toBe(90);
  });

  it('generates fast PDF directly from pages', async () => {
    // 1x1 dummy JPEG
    const dummyJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const mockPage = {
      id: 'p1',
      captureId: 'c1',
      sourceImage: dummyJpg,
      processedImage: dummyJpg,
      thumbnail: dummyJpg,
      rotation: 0 as const,
      filter: 'clean' as const,
      annotations: [],
      status: 'committed' as const,
      pageNumber: 1,
      width: 100,
      height: 100,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const { pdfBytes, filename } = await pdfService.generateFastPDF([mockPage]);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(500);
    expect(filename).toContain('.pdf');

    const loadedDoc = await PDFDocument.load(pdfBytes);
    expect(loadedDoc.getPageCount()).toBe(1);
  });
});
