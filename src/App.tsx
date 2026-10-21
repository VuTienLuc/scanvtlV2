import React, { useState, useEffect } from 'react';
import type { PageRecord, QuadCorners, FilterType, DrawingStroke, OCRData, MathOCRFormula, PaperFormat } from './types/scanner';
import { getCommittedPages, saveDraftPage, getSetting, setSetting } from './db/dexieDb';
import { ToastProvider, useToast } from './components/common/Toast';
import { HomeDashboard } from './components/home/HomeDashboard';
import { CameraScanner, type ScanMode } from './components/scanner/CameraScanner';
import { ImageEditor } from './components/editor/ImageEditor';
import { BookSplitterModal } from './components/book/BookSplitterModal';
import { PageManager } from './components/manager/PageManager';
import { PDFExportModal } from './components/pdf/PDFExportModal';
import { PDFToolsStudio } from './components/pdf/PDFToolsStudio';
import { TextOCRModal } from './components/ocr/TextOCRModal';
import { MathOCRStudio } from './components/math/MathOCRStudio';
import { WordExportModal } from './components/docx/WordExportModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { generateThumbnailFromDataUrl } from './services/cvService';
import { pdfService } from './services/pdfService';

type AppView = 'home' | 'camera' | 'editor' | 'book-split' | 'manager';

const ScannerApp: React.FC = () => {
  const { showToast } = useToast();

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Active view
  const [currentView, setCurrentView] = useState<AppView>('home');

  // Committed document pages
  const [committedPages, setCommittedPages] = useState<PageRecord[]>([]);

  // Current session capture states
  const [currentCaptureSource, setCurrentCaptureSource] = useState<string | null>(null);
  const [currentCaptureId, setCurrentCaptureId] = useState<string>('');
  const [scanMode, setScanMode] = useState<ScanMode>('single');

  // Editing existing page in ImageEditor
  const [editingPage, setEditingPage] = useState<PageRecord | null>(null);

  // Modals
  const [isPDFExportOpen, setIsPDFExportOpen] = useState(false);
  const [isWordExportOpen, setIsWordExportOpen] = useState(false);
  const [isPDFToolsOpen, setIsPDFToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeOCRPage, setActiveOCRPage] = useState<PageRecord | null>(null);
  const [activeMathPage, setActiveMathPage] = useState<PageRecord | null>(null);

  // Initialize theme & recover draft pages from IndexedDB on startup
  useEffect(() => {
    async function initApp() {
      // Theme
      const savedTheme = await getSetting<'dark' | 'light'>('app_theme', 'dark');
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);

      // Draft recovery from IndexedDB
      try {
        const pages = await getCommittedPages();
        if (pages.length > 0) {
          setCommittedPages(pages);
          showToast(`Đã khôi phục phiên làm việc trước (${pages.length} trang)`, 'info', 3500);
        }
      } catch (e) {
        console.warn('Lỗi đọc dữ liệu IndexedDB:', e);
      }
    }

    initApp();
  }, [showToast]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    await setSetting('app_theme', nextTheme);
  };

  // Start single page scan
  const handleStartSingleScan = () => {
    setScanMode('single');
    setCurrentView('camera');
  };

  // Start continuous rapid scan
  const handleStartContinuousScan = () => {
    setScanMode('continuous');
    setCurrentView('camera');
  };

  // Start book scan
  const handleStartBookScan = () => {
    setScanMode('book');
    setCurrentView('camera');
  };

  // Camera captures single or book image
  const handleCapture = (sourceDataUrl: string, isBookMode: boolean) => {
    const captureId = `cap_${Date.now()}`;
    setCurrentCaptureId(captureId);
    setCurrentCaptureSource(sourceDataUrl);
    setScanMode(isBookMode ? 'book' : 'single');

    if (isBookMode) {
      setCurrentView('book-split');
    } else {
      setEditingPage(null); // Fresh page
      setCurrentView('editor');
    }
  };

  // Fast continuous capture: auto-processes and saves without leaving camera
  const handleContinuousCapture = async (sourceDataUrl: string) => {
    const timestamp = Date.now();
    const thumbnail = await generateThumbnailFromDataUrl(sourceDataUrl);

    const newPage: PageRecord = {
      id: `page_${timestamp}_${Math.random().toString(36).substr(2, 4)}`,
      captureId: `cap_cont_${timestamp}`,
      sourceImage: sourceDataUrl,
      processedImage: sourceDataUrl,
      thumbnail,
      rotation: 0,
      filter: 'clean',
      annotations: [],
      status: 'committed',
      pageNumber: committedPages.length + 1,
      width: 1200,
      height: 1697,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await saveDraftPage(newPage);
    setCommittedPages((prev) => [...prev, newPage]);
  };

  // Batch import multiple image files at once
  const handleBatchImportFiles = async (files: File[]) => {
    const newPages: PageRecord[] = [];
    const baseTime = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      const thumbnail = await generateThumbnailFromDataUrl(dataUrl);
      const pageTime = baseTime + i;

      const page: PageRecord = {
        id: `page_import_${pageTime}_${i}`,
        captureId: `cap_batch_${baseTime}`,
        sourceImage: dataUrl,
        processedImage: dataUrl,
        thumbnail,
        rotation: 0,
        filter: 'clean',
        annotations: [],
        status: 'committed',
        pageNumber: committedPages.length + i + 1,
        width: 1200,
        height: 1697,
        createdAt: pageTime,
        updatedAt: pageTime
      };

      await saveDraftPage(page);
      newPages.push(page);
    }

    setCommittedPages((prev) => [...prev, ...newPages]);
    showToast(`⚡ Đã nạp thành công ${files.length} trang vào tài liệu!`, 'success');
  };

  // Instant 1-click fast PDF creation & download with A4/A5 support
  const handleFastExportPDF = async (format: PaperFormat = 'a4') => {
    if (committedPages.length === 0) {
      showToast('Chưa có trang nào để tạo PDF', 'error');
      return;
    }

    try {
      showToast(`Đang tạo PDF ${format.toUpperCase()} siêu nét cho AI...`, 'info', 1000);
      const { pdfBytes, filename } = await pdfService.generateFastPDF(committedPages, undefined, undefined, format);

      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`⚡ Đã tải xuống ${filename} (${committedPages.length} trang)!`, 'success', 4000);
    } catch (err: any) {
      showToast('Lỗi tạo PDF: ' + err.message, 'error');
    }
  };

  // Re-crop an existing committed page
  const handleReCropPage = (page: PageRecord) => {
    setEditingPage(page);
    setCurrentCaptureSource(page.sourceImage);
    setCurrentCaptureId(page.captureId);
    setCurrentView('editor');
  };

  // Commit page from ImageEditor
  const handleCommitEditorPage = async (
    processedDataUrl: string,
    thumbnailDataUrl: string,
    cropCorners: QuadCorners,
    filter: FilterType,
    rotation: 0 | 90 | 180 | 270,
    annotations: DrawingStroke[],
    width: number,
    height: number
  ) => {
    const timestamp = Date.now();

    if (editingPage) {
      // Update existing page
      const updated: PageRecord = {
        ...editingPage,
        processedImage: processedDataUrl,
        thumbnail: thumbnailDataUrl,
        cropCorners,
        filter,
        rotation,
        annotations,
        width,
        height,
        updatedAt: timestamp
      };

      await saveDraftPage(updated);
      setCommittedPages((prev) => prev.map((p) => (p.id === editingPage.id ? updated : p)));
      setEditingPage(null);
      setCurrentView('manager');
    } else {
      // Add new page
      const newPage: PageRecord = {
        id: `page_${timestamp}`,
        captureId: currentCaptureId,
        sourceImage: currentCaptureSource || processedDataUrl,
        processedImage: processedDataUrl,
        thumbnail: thumbnailDataUrl,
        cropCorners,
        filter,
        rotation,
        annotations,
        status: 'committed',
        pageNumber: committedPages.length + 1,
        width,
        height,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await saveDraftPage(newPage);
      setCommittedPages((prev) => [...prev, newPage]);
      setCurrentView('camera'); // Return to camera to scan next page
    }

    setCurrentCaptureSource(null);
  };

  // Commit pages from BookSplitterModal
  const handleCommitBookPages = async (newPages: PageRecord[]) => {
    for (const page of newPages) {
      await saveDraftPage(page);
    }

    setCommittedPages((prev) => {
      const combined = [...prev, ...newPages];
      return combined.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });

    setCurrentCaptureSource(null);
    setCurrentView('camera'); // Return to camera for next book page
  };

  // Update whole pages list (from reorder/delete in PageManager)
  const handleUpdatePages = async (updatedPages: PageRecord[]) => {
    setCommittedPages(updatedPages);
    for (const page of updatedPages) {
      await saveDraftPage(page);
    }
  };

  // Save OCR text data to page
  const handleSavePageOCR = async (pageId: string, ocrData: OCRData) => {
    const updated = committedPages.map((p) => (p.id === pageId ? { ...p, ocrData, updatedAt: Date.now() } : p));
    setCommittedPages(updated);
    const target = updated.find((p) => p.id === pageId);
    if (target) await saveDraftPage(target);
  };

  // Save Math formula to page
  const handleSavePageMathFormula = async (pageId: string, formula: MathOCRFormula) => {
    const updated = committedPages.map((p) => {
      if (p.id === pageId) {
        const existing = p.mathFormulas || [];
        return {
          ...p,
          mathFormulas: [...existing.filter((f) => f.id !== formula.id), formula],
          updatedAt: Date.now()
        };
      }
      return p;
    });
    setCommittedPages(updated);
    const target = updated.find((p) => p.id === pageId);
    if (target) await saveDraftPage(target);
  };

  // Import file directly from file picker
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    if (fileList.length > 1) {
      await handleBatchImportFiles(fileList);
    } else {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          handleCapture(result, false);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  return (
    <>
      {/* 1. Home Dashboard View */}
      {currentView === 'home' && (
        <HomeDashboard
          committedPages={committedPages}
          theme={theme}
          onToggleTheme={toggleTheme}
          onStartSingleScan={handleStartSingleScan}
          onStartContinuousScan={handleStartContinuousScan}
          onStartBookScan={handleStartBookScan}
          onOpenPageManager={() => setCurrentView('manager')}
          onOpenExportPDF={() => setIsPDFExportOpen(true)}
          onOpenPDFTools={() => setIsPDFToolsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onImportFile={handleImportFile}
        />
      )}

      {/* 2. Camera Scanner View */}
      {currentView === 'camera' && (
        <CameraScanner
          committedPages={committedPages}
          initialMode={scanMode}
          onCapture={handleCapture}
          onContinuousCapture={handleContinuousCapture}
          onBatchImportFiles={handleBatchImportFiles}
          onFastExportPDF={handleFastExportPDF}
          onOpenPageManager={() => setCurrentView('manager')}
          onClose={() => setCurrentView(committedPages.length > 0 ? 'manager' : 'home')}
        />
      )}

      {/* 3. Image Editor View (Crop, Perspective, Filter, Annotation) */}
      {currentView === 'editor' && currentCaptureSource && (
        <ImageEditor
          sourceDataUrl={currentCaptureSource}
          initialCorners={editingPage?.cropCorners}
          initialFilter={editingPage?.filter || 'clean'}
          initialRotation={editingPage?.rotation || 0}
          initialAnnotations={editingPage?.annotations || []}
          onCommit={handleCommitEditorPage}
          onDiscard={() => {
            setCurrentCaptureSource(null);
            setEditingPage(null);
            setCurrentView(editingPage ? 'manager' : 'camera');
          }}
        />
      )}

      {/* 4. Book Splitter View */}
      {currentView === 'book-split' && currentCaptureSource && (
        <BookSplitterModal
          sourceDataUrl={currentCaptureSource}
          captureId={currentCaptureId}
          onCommitPages={handleCommitBookPages}
          onDiscard={() => {
            setCurrentCaptureSource(null);
            setCurrentView('camera');
          }}
        />
      )}

      {/* 5. Page Manager View */}
      {currentView === 'manager' && (
        <PageManager
          pages={committedPages}
          onUpdatePages={handleUpdatePages}
          onAddMorePages={() => setCurrentView('camera')}
          onReCropPage={handleReCropPage}
          onOpenExportPDF={() => setIsPDFExportOpen(true)}
          onOpenExportWord={() => setIsWordExportOpen(true)}
          onOpenTextOCR={(p) => setActiveOCRPage(p)}
          onOpenMathOCR={(p) => setActiveMathPage(p)}
          onOpenPDFTools={() => setIsPDFToolsOpen(true)}
          onBackToScanner={() => setCurrentView('camera')}
        />
      )}

      {/* Global Modals */}
      {isPDFExportOpen && (
        <PDFExportModal
          pages={committedPages}
          onClose={() => setIsPDFExportOpen(false)}
        />
      )}

      {isWordExportOpen && (
        <WordExportModal
          pages={committedPages}
          onClose={() => setIsWordExportOpen(false)}
        />
      )}

      {isPDFToolsOpen && (
        <PDFToolsStudio
          onClose={() => setIsPDFToolsOpen(false)}
        />
      )}

      {activeOCRPage && (
        <TextOCRModal
          page={activeOCRPage}
          onSaveOCR={handleSavePageOCR}
          onClose={() => setActiveOCRPage(null)}
        />
      )}

      {activeMathPage && (
        <MathOCRStudio
          page={activeMathPage}
          onSaveFormula={handleSavePageMathFormula}
          onOpenSettings={() => {
            setActiveMathPage(null);
            setIsSettingsOpen(true);
          }}
          onClose={() => setActiveMathPage(null)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          theme={theme}
          onToggleTheme={toggleTheme}
          onClearDrafts={() => setCommittedPages([])}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <ScannerApp />
    </ToastProvider>
  );
}
