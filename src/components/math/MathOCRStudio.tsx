import React, { useState, useRef, useEffect } from 'react';
import katex from 'katex';
import {
  Sigma,
  Copy,
  Check,
  X,
  Sparkles,
  Settings,
  AlertTriangle
} from 'lucide-react';
import type { PageRecord, MathOCRFormula, MathProviderConfig } from '../../types/scanner';
import { mathOcrService } from '../../services/mathOcrService';
import { useToast } from '../common/Toast';

interface MathOCRStudioProps {
  page: PageRecord;
  onSaveFormula: (pageId: string, formula: MathOCRFormula) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export const MathOCRStudio: React.FC<MathOCRStudioProps> = ({
  page,
  onSaveFormula,
  onOpenSettings,
  onClose
}) => {
  const { showToast } = useToast();

  const [config, setConfig] = useState<MathProviderConfig>({ provider: 'offline', apiKey: '' });
  const [selectedBox, setSelectedBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const [latexCode, setLatexCode] = useState<string>('\\int_{0}^{\\pi} \\sin(x) \\, dx = 2');
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [katexError, setKatexError] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      const cfg = await mathOcrService.getConfig();
      setConfig(cfg);
    }
    loadConfig();
  }, []);

  // Update KaTeX rendered equation whenever latexCode changes
  useEffect(() => {
    try {
      const html = katex.renderToString(latexCode || '', {
        throwOnError: false,
        displayMode: true
      });
      setRenderedHtml(html);
      setKatexError(null);
    } catch (e: any) {
      setKatexError(e.message || 'Lỗi cú pháp LaTeX');
    }
  }, [latexCode]);

  // Mouse & Touch events for drawing bounding box on page
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    setStartPoint({ x, y });
    setSelectedBox({ x, y, w: 0, h: 0 });
    setIsSelecting(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isSelecting || !startPoint || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const w = Math.abs(currentX - startPoint.x);
    const h = Math.abs(currentY - startPoint.y);

    setSelectedBox({ x, y, w, h });
  };

  const handlePointerUp = () => {
    setIsSelecting(false);
    setStartPoint(null);
  };

  // Extract cropped formula image from page canvas
  const getCroppedFormulaDataUrl = (): string | null => {
    if (!imageRef.current || !selectedBox || selectedBox.w < 10 || selectedBox.h < 10) {
      return null;
    }

    const img = imageRef.current;
    const scaleX = (page.width || img.naturalWidth) / img.width;
    const scaleY = (page.height || img.naturalHeight) / img.height;

    const realX = Math.round(selectedBox.x * scaleX);
    const realY = Math.round(selectedBox.y * scaleY);
    const realW = Math.round(selectedBox.w * scaleX);
    const realH = Math.round(selectedBox.h * scaleY);

    const canvas = document.createElement('canvas');
    canvas.width = realW;
    canvas.height = realH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const pageImg = new Image();
    pageImg.crossOrigin = 'anonymous';
    pageImg.src = page.processedImage;

    ctx.drawImage(pageImg, realX, realY, realW, realH, 0, 0, realW, realH);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // Execute Math OCR
  const handleRecognizeFormula = async () => {
    const cropDataUrl = getCroppedFormulaDataUrl();
    if (!cropDataUrl) {
      showToast('Vui lòng quét chuột hoặc chạm kéo để chọn vùng chứa công thức.', 'info');
      return;
    }

    setIsProcessing(true);
    setStatusNote(null);

    try {
      const result = await mathOcrService.recognizeFormula(cropDataUrl, config);
      setLatexCode(result.latex);
      setStatusNote(result.note || null);

      if (config.provider === 'offline' || !config.apiKey.trim()) {
        showToast('Chế độ Offline / Chưa có API Key. Bạn có thể tự soạn hoặc cấu hình API.', 'info');
      } else {
        showToast('Đã nhận diện công thức Toán!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi nhận diện công thức', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick insertion of math symbols
  const insertSymbol = (code: string) => {
    setLatexCode((prev) => `${prev} ${code}`.trim());
  };

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latexCode);
    showToast('Đã chép mã LaTeX vào khay nhớ tạm!', 'success');
  };

  const handleSaveToPage = () => {
    if (!latexCode.trim()) return;

    const formula: MathOCRFormula = {
      id: `math_${Date.now()}`,
      latex: latexCode,
      status: 'verified',
      box: selectedBox
        ? { x: selectedBox.x, y: selectedBox.y, width: selectedBox.w, height: selectedBox.h }
        : { x: 0, y: 0, width: 100, height: 50 },
      note: statusNote || undefined
    };

    onSaveFormula(page.id, formula);
    showToast('Đã lưu công thức vào trang!', 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 960, height: '90vh' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sigma size={22} color="#10b981" />
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                OCR Công thức Toán học — Trang {page.pageNumber}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Nhà cung cấp: {config.provider === 'gemini' ? 'Google Gemini Vision' : config.provider === 'simpletex' ? 'SimpleTex API' : config.provider === 'mathpix' ? 'Mathpix' : 'Offline / Bảng soạn thảo'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onOpenSettings} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
              <Settings size={14} /> Cấu hình API
            </button>
            <button onClick={onClose} className="btn-ghost">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Studio Workspace: Crop Page on Left, KaTeX Preview & LaTeX on Right */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Interactive Formula Region Selector */}
          <div
            style={{
              flex: 1.1,
              background: '#090d16',
              borderRight: '1px solid var(--border-default)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10, fontSize: 12, color: '#94a3b8', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 4 }}>
              👆 Kéo chuột/ngón tay để khoanh vùng công thức
            </div>

            <div
              ref={imageContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: 'relative',
                display: 'inline-block',
                touchAction: 'none',
                cursor: 'crosshair',
                maxHeight: '100%',
                maxWidth: '100%'
              }}
            >
              <img
                ref={imageRef}
                src={page.processedImage}
                alt="Trang tài liệu để chọn công thức"
                style={{
                  maxHeight: '70vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 4,
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />

              {/* Highlight selection box */}
              {selectedBox && (
                <div
                  style={{
                    position: 'absolute',
                    left: selectedBox.x,
                    top: selectedBox.y,
                    width: selectedBox.w,
                    height: selectedBox.h,
                    border: '2px solid #10b981',
                    background: 'rgba(16, 185, 129, 0.25)',
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>

            <button
              onClick={handleRecognizeFormula}
              disabled={isProcessing}
              className="btn btn-emerald"
              style={{ marginTop: 12, width: '90%' }}
            >
              <Sparkles size={16} /> Nhận diện vùng đã chọn
            </button>
          </div>

          {/* Right Column: KaTeX Rendered Preview & LaTeX Editor */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', padding: 16, background: 'var(--bg-surface)', overflowY: 'auto' }}>
            {/* KaTeX Live Render Card */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Hiển thị công thức trực quan (KaTeX):
              </span>
              <div
                style={{
                  minHeight: 80,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 19,
                  overflowX: 'auto'
                }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
              {katexError && (
                <div style={{ color: '#f43f5e', fontSize: 12, marginTop: 4 }}>
                  ⚠️ {katexError}
                </div>
              )}
            </div>

            {/* Symbols Palette */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Chèn nhanh ký hiệu Toán:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: 'a/b', code: '\\frac{a}{b}' },
                  { label: '√x', code: '\\sqrt{x}' },
                  { label: 'xⁿ', code: 'x^{n}' },
                  { label: 'xᵢ', code: 'x_{i}' },
                  { label: '∫', code: '\\int_{a}^{b} f(x) \\, dx' },
                  { label: '∑', code: '\\sum_{i=1}^{n}' },
                  { label: 'lim', code: '\\lim_{x \\to 0}' },
                  { label: '→', code: '\\vec{v}' },
                  { label: 'Hệ PT', code: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}' },
                  { label: 'Ma trận', code: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' }
                ].map((sym) => (
                  <button
                    key={sym.label}
                    onClick={() => insertSymbol(sym.code)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    {sym.label}
                  </button>
                ))}
              </div>
            </div>

            {/* LaTeX Code Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Mã LaTeX (có thể gõ hoặc sửa):
                </span>
                <button onClick={handleCopyLatex} className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px' }}>
                  <Copy size={14} /> Sao chép mã
                </button>
              </div>

              <textarea
                value={latexCode}
                onChange={(e) => setLatexCode(e.target.value)}
                placeholder="Nhập hoặc kiểm tra mã LaTeX ở đây..."
                style={{
                  flex: 1,
                  minHeight: 120,
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: '#10b981',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  lineHeight: 1.5,
                  padding: 12,
                  outline: 'none',
                  resize: 'none'
                }}
              />

              {statusNote && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f59e0b', marginTop: 8 }}>
                  <AlertTriangle size={14} /> {statusNote}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button onClick={handleCopyLatex} className="btn btn-secondary">
            <Copy size={16} /> Sao chép LaTeX
          </button>

          <button onClick={handleSaveToPage} className="btn btn-emerald">
            <Check size={16} /> Lưu công thức vào tài liệu
          </button>
        </div>
      </div>
    </div>
  );
};
