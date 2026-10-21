export interface Point {
  x: number;
  y: number;
}

export interface QuadCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export type PaperFormat = 'a4' | 'a5';

export type FilterType = 'original' | 'enhanced' | 'grayscale' | 'bw' | 'clean' | 'ai_sharp';

export type PageStatus = 'captured' | 'editing' | 'committed' | 'exporting' | 'exported';

export interface DrawingStroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  words: OCRWord[];
}

export interface OCRData {
  text: string;
  confidence: number;
  lines: OCRLine[];
  language: string;
  processedAt: number;
}

export interface MathOCRFormula {
  id: string;
  latex: string;
  confidence?: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  status: 'detected' | 'verified';
  note?: string;
}

export interface PageRecord {
  id: string;
  captureId: string;
  documentId?: string;
  sourceImage: string; // High-res original captured image
  processedImage: string; // Final rendered image with crop, rotation, filter, annotations
  thumbnail: string; // Low-res fast thumbnail for grid
  cropCorners?: QuadCorners;
  rotation: 0 | 90 | 180 | 270;
  filter: FilterType;
  annotations: DrawingStroke[];
  status: PageStatus;
  pageNumber: number;
  ocrData?: OCRData;
  mathFormulas?: MathOCRFormula[];
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentSession {
  id: string;
  title: string;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export type MathProviderType = 'offline' | 'gemini' | 'simpletex' | 'mathpix';

export interface MathProviderConfig {
  provider: MathProviderType;
  apiKey: string;
  endpoint?: string;
  model?: string;
}

export interface PDFExportOptions {
  pageSize: 'a4' | 'a5' | 'letter';
  orientation: 'portrait' | 'landscape' | 'auto';
  quality: 0.3 | 0.6 | 0.85 | 1.0;
  filename: string;
  includeSearchableText: boolean;
  marginMm: number;
}

export interface DOCXExportOptions {
  mode: 'image-based' | 'editable';
  filename: string;
  includeMathOMML: boolean;
  includeOriginalPageNumber: boolean;
}
