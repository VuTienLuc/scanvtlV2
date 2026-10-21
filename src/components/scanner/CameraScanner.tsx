import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  BookOpen,
  CameraOff,
  Upload,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  ArrowLeft,
  Zap,
  Timer,
  Download,
  Layers,
  Sparkles,
  Crop
} from 'lucide-react';
import { cameraService, type CameraError } from '../../services/cameraService';
import { enhanceForAiOCR } from '../../services/cvService';
import { useToast } from '../common/Toast';
import type { PageRecord, PaperFormat } from '../../types/scanner';

export type ScanMode = 'single' | 'continuous' | 'book';

interface CameraScannerProps {
  onCapture: (sourceDataUrl: string, isBookMode: boolean) => void;
  onContinuousCapture: (sourceDataUrl: string) => Promise<void>;
  onBatchImportFiles?: (files: File[]) => Promise<void>;
  onFastExportPDF?: (format?: PaperFormat) => Promise<void>;
  onOpenPageManager: () => void;
  onClose: () => void;
  committedPages: PageRecord[];
  initialMode?: ScanMode;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onCapture,
  onContinuousCapture,
  onBatchImportFiles,
  onFastExportPDF,
  onOpenPageManager,
  onClose,
  committedPages,
  initialMode = 'single'
}) => {
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanMode, setScanMode] = useState<ScanMode>(initialMode);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Paper format guide standard: A4 vs A5
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('a4');
  // AI OCR sharpness & paper whitening enhancement
  const [isAiSharp, setIsAiSharp] = useState<boolean>(true);
  // Auto crop directly to guide box (removes desk & background)
  const [isCropToGuide, setIsCropToGuide] = useState<boolean>(true);
  const guideRef = useRef<HTMLDivElement>(null);

  // Auto-timer for continuous hands-free scanning (0 = off, 2 = 2s, 3 = 3s, 4 = 4s)
  const [autoTimerSeconds, setAutoTimerSeconds] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Shutter flash effect
  const [isFlashing, setIsFlashing] = useState(false);
  const [isSavingContinuous, setIsSavingContinuous] = useState(false);

  // Initialize camera stream
  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      setIsLoading(true);
      setCameraError(null);
      try {
        const { stream } = await cameraService.startCamera({ facingMode });
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsLoading(false);
            setHasTorch(cameraService.hasTorch());
          };
        }
      } catch (err: any) {
        if (isMounted) {
          setIsLoading(false);
          setCameraError(err);
          showToast(err.message || 'Lỗi kết nối máy ảnh', 'error');
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      cameraService.stopCamera();
    };
  }, [facingMode, showToast]);

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleToggleTorch = async () => {
    const nextState = await cameraService.toggleTorch();
    setIsTorchOn(nextState);
  };

  // Capture frame strictly inside A4 / A5 guide or full sensor
  const captureFrameDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const guide = guideRef.current;

    let targetCanvas: HTMLCanvasElement;

    if (isCropToGuide && guide) {
      const videoRect = video.getBoundingClientRect();
      const guideRect = guide.getBoundingClientRect();
      const cw = videoRect.width;
      const ch = videoRect.height;

      if (cw > 0 && ch > 0) {
        // Calculate mapping when video has CSS objectFit: 'cover'
        const scale = Math.max(cw / vw, ch / vh);
        const renderedW = vw * scale;
        const renderedH = vh * scale;
        const offsetX = (renderedW - cw) / 2;
        const offsetY = (renderedH - ch) / 2;

        const cropX = Math.max(0, Math.min(vw - 20, ((guideRect.left - videoRect.left) + offsetX) / scale));
        const cropY = Math.max(0, Math.min(vh - 20, ((guideRect.top - videoRect.top) + offsetY) / scale));
        const cropW = Math.max(40, Math.min(vw - cropX, guideRect.width / scale));
        const cropH = Math.max(40, Math.min(vh - cropY, guideRect.height / scale));

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cropW);
        canvas.height = Math.round(cropH);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          targetCanvas = canvas;
        } else {
          const fCanvas = document.createElement('canvas');
          fCanvas.width = vw;
          fCanvas.height = vh;
          const fCtx = fCanvas.getContext('2d');
          fCtx?.drawImage(video, 0, 0);
          targetCanvas = fCanvas;
        }
      } else {
        const fCanvas = document.createElement('canvas');
        fCanvas.width = vw;
        fCanvas.height = vh;
        const fCtx = fCanvas.getContext('2d');
        fCtx?.drawImage(video, 0, 0);
        targetCanvas = fCanvas;
      }
    } else {
      const fCanvas = document.createElement('canvas');
      fCanvas.width = vw;
      fCanvas.height = vh;
      const fCtx = fCanvas.getContext('2d');
      fCtx?.drawImage(video, 0, 0);
      targetCanvas = fCanvas;
    }

    // Apply AI document sharpness & contrast enhancement if enabled
    if (isAiSharp) {
      targetCanvas = enhanceForAiOCR(targetCanvas);
    }

    return targetCanvas.toDataURL('image/jpeg', 0.96);
  }, [isCropToGuide, isAiSharp]);

  // Main shutter click handler
  const handleCapture = useCallback(async () => {
    if (isSavingContinuous) return;

    const dataUrl = captureFrameDataUrl();
    if (!dataUrl) {
      showToast('Máy ảnh chưa sẵn sàng.', 'error');
      return;
    }

    // Trigger visual shutter flash & vibration
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    if (scanMode === 'continuous') {
      // Continuous mode: directly save page and stay in camera!
      setIsSavingContinuous(true);
      try {
        await onContinuousCapture(dataUrl);
        showToast(`⚡ Đã quét trang ${committedPages.length + 1}`, 'success', 1500);
      } catch (e: any) {
        showToast('Lỗi lưu trang nhanh: ' + e.message, 'error');
      } finally {
        setIsSavingContinuous(false);
      }
    } else {
      // Single or Book mode: navigate to editor / book splitter
      onCapture(dataUrl, scanMode === 'book');
    }
  }, [isSavingContinuous, captureFrameDataUrl, scanMode, onContinuousCapture, committedPages.length, showToast, onCapture]);

  // Auto-capture countdown loop when continuous timer is active
  useEffect(() => {
    if (scanMode !== 'continuous' || autoTimerSeconds <= 0 || isLoading || cameraError) {
      setCountdown(null);
      return;
    }

    setCountdown(autoTimerSeconds);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return autoTimerSeconds;
        if (prev <= 1) {
          // Snap picture!
          handleCapture();
          return autoTimerSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [scanMode, autoTimerSeconds, isLoading, cameraError, handleCapture]);

  // Multi-file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    if (fileList.length > 1 && onBatchImportFiles) {
      // Multiple files imported: batch add them directly!
      showToast(`Đang nạp nhanh ${fileList.length} ảnh...`, 'info');
      await onBatchImportFiles(fileList);
    } else {
      // Single file imported: preview in editor
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onCapture(result, scanMode === 'book');
        }
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  };

  const lastThumbnail = committedPages.length > 0 ? committedPages[committedPages.length - 1].thumbnail : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      {/* Top Header Bar */}
      <div
        style={{
          height: 60,
          background: 'rgba(9, 13, 22, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 20
        }}
      >
        <button
          onClick={onClose}
          className="btn-ghost"
          style={{ padding: 8, borderRadius: '50%', color: '#fff', cursor: 'pointer', display: 'flex' }}
          title="Quay lại"
        >
          <ArrowLeft size={22} />
        </button>

        {/* Scan Mode Switcher Pills */}
        <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.8)', borderRadius: 10, padding: 3, gap: 2 }}>
          <button
            onClick={() => setScanMode('continuous')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: scanMode === 'continuous' ? '#3b82f6' : 'transparent',
              color: scanMode === 'continuous' ? '#fff' : '#94a3b8',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            title="Quét liên tục nhiều trang không gián đoạn"
          >
            <Zap size={14} color={scanMode === 'continuous' ? '#fde047' : '#94a3b8'} /> Quét liên tục
          </button>

          <button
            onClick={() => setScanMode('single')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: scanMode === 'single' ? '#3b82f6' : 'transparent',
              color: scanMode === 'single' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Camera size={14} /> 1 Trang
          </button>

          <button
            onClick={() => setScanMode('book')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: scanMode === 'book' ? '#10b981' : 'transparent',
              color: scanMode === 'book' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <BookOpen size={14} /> Sách
          </button>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Continuous Auto Timer toggle */}
          {scanMode === 'continuous' && (
            <button
              onClick={() => {
                const next = autoTimerSeconds === 0 ? 3 : autoTimerSeconds === 3 ? 2 : 0;
                setAutoTimerSeconds(next);
                if (next > 0) {
                  showToast(`Đã bật tự động chụp mỗi ${next} giây (rảnh tay lật trang)`, 'info');
                } else {
                  showToast('Đã tắt hẹn giờ tự chụp', 'info');
                }
              }}
              className="btn-ghost"
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                color: autoTimerSeconds > 0 ? '#fde047' : '#94a3b8',
                background: autoTimerSeconds > 0 ? 'rgba(253, 224, 71, 0.2)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
              title="Hẹn giờ tự động chụp sau vài giây"
            >
              <Timer size={16} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {autoTimerSeconds > 0 ? `${autoTimerSeconds}s` : 'Hẹn giờ'}
              </span>
            </button>
          )}

          {/* Torch toggle */}
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className="btn-ghost"
              style={{ padding: 8, borderRadius: '50%', color: isTorchOn ? '#f59e0b' : '#fff', cursor: 'pointer', display: 'flex' }}
              title="Đèn Flash"
            >
              {isTorchOn ? <Flashlight size={20} /> : <FlashlightOff size={20} />}
            </button>
          )}

          {/* Switch Camera */}
          <button
            onClick={handleSwitchCamera}
            className="btn-ghost"
            style={{ padding: 8, borderRadius: '50%', color: '#fff', cursor: 'pointer', display: 'flex' }}
            title="Đổi camera trước/sau"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Floating Toolbar: A4 / A5 + Nét AI + Cắt khung */}
      <div
        style={{
          position: 'absolute',
          top: 68,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 'var(--radius-full)',
          padding: '4px 8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
          maxWidth: '92%'
        }}
      >
        {/* A4 vs A5 Toggle */}
        <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.7)', borderRadius: 'var(--radius-full)', padding: 2 }}>
          <button
            onClick={() => {
              setPaperFormat('a4');
              showToast('Khung chuẩn A4 (Tỉ lệ 1 : 1.414)', 'info', 1200);
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: paperFormat === 'a4' ? '#3b82f6' : 'transparent',
              color: paperFormat === 'a4' ? '#fff' : '#94a3b8',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Khổ A4
          </button>
          <button
            onClick={() => {
              setPaperFormat('a5');
              showToast('Khung chuẩn A5 (Gọn gàng cho sách vở A5)', 'info', 1200);
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: paperFormat === 'a5' ? '#f59e0b' : 'transparent',
              color: paperFormat === 'a5' ? '#fff' : '#94a3b8',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Khổ A5
          </button>
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.15)' }} />

        {/* AI Sharp toggle */}
        <button
          onClick={() => {
            setIsAiSharp((prev) => !prev);
            showToast(!isAiSharp ? 'Đã bật NÉT CHUẨN AI (Sắc nét chữ, trắng sáng giấy)' : 'Đã tắt nét AI (Dùng ảnh gốc)', 'info', 1500);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: isAiSharp ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            color: isAiSharp ? '#38bdf8' : '#94a3b8',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          title="Làm trắng nền giấy & tăng độ nét chữ cho AI đọc chính xác"
        >
          <Sparkles size={13} /> {isAiSharp ? 'Nét AI: BẬT' : 'Nét AI: TẮT'}
        </button>

        <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.15)' }} />

        {/* Crop to Guide toggle */}
        <button
          onClick={() => {
            setIsCropToGuide((prev) => !prev);
            showToast(!isCropToGuide ? 'Cắt chính xác chỉ lấy vùng trong khung A4/A5' : 'Chụp toàn cảnh (Không cắt theo khung)', 'info', 1500);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: isCropToGuide ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
            color: isCropToGuide ? '#34d399' : '#94a3b8',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          title="Tự động cắt đúng hình ảnh nằm trong khung A4/A5"
        >
          <Crop size={13} /> {isCropToGuide ? 'Khớp Khung' : 'Toàn Cảnh'}
        </button>
      </div>

      {/* Video Viewport / Error View */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16'
        }}
      >
        {/* Shutter White Flash Animation */}
        {isFlashing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#ffffff',
              zIndex: 30,
              animation: 'fadeOut 0.12s ease'
            }}
          />
        )}

        {/* Auto Timer Countdown Overlay Badge */}
        {countdown !== null && countdown > 0 && scanMode === 'continuous' && (
          <div
            style={{
              position: 'absolute',
              zIndex: 25,
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.85)',
              border: '3px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 36,
              fontWeight: 800,
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.6)'
            }}
          >
            {countdown}
          </div>
        )}

        {isLoading && (
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 15 }}>
            <div className="loader-spinner" />
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Đang kết nối máy ảnh...</span>
          </div>
        )}

        {cameraError ? (
          <div style={{ maxWidth: 360, textAlign: 'center', padding: 24, zIndex: 20 }}>
            <CameraOff size={48} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#fff' }}>
              Không thể mở máy ảnh
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              {cameraError.message}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <Upload size={18} /> Chọn tệp ảnh từ thiết bị (Hỗ trợ chọn nhiều)
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Guide overlay box */}
            <div
              ref={guideRef}
              className={`a4-guide ${paperFormat === 'a5' ? 'a5-mode' : ''} ${scanMode === 'book' ? 'book-mode' : ''}`}
            >
              <div className="guide-corner guide-corner-tl" />
              <div className="guide-corner guide-corner-tr" />
              <div className="guide-corner guide-corner-bl" />
              <div className="guide-corner guide-corner-br" />
              <div className="guide-badge">
                {scanMode === 'book'
                  ? `SÁCH 2 TRANG (${paperFormat.toUpperCase()})`
                  : `KHUNG ${paperFormat.toUpperCase()} ${isCropToGuide ? '• CẮT CHUẨN' : ''}`}
                {isAiSharp ? ' • ✨ NÉT AI' : ''}
              </div>
            </div>
          </>
        )}

        {/* Multi-file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </div>

      {/* Bottom Controls Bar */}
      <div
        style={{
          background: '#090d16',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 20px 16px',
          zIndex: 20,
          borderTop: '1px solid #1e293b'
        }}
      >
        {/* Fast Action Row: Instant PDF Download button */}
        {committedPages.length > 0 && onFastExportPDF && (
          <div style={{ width: '100%', maxWidth: 440, marginBottom: 10, display: 'flex', gap: 8 }}>
            <button
              onClick={() => onFastExportPDF(paperFormat)}
              className="btn btn-emerald"
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Download size={16} /> Tạo PDF {paperFormat.toUpperCase()} Siêu Nét ({committedPages.length} trang)
            </button>

            <button
              onClick={onOpenPageManager}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: 13, borderRadius: 'var(--radius-full)' }}
            >
              <Layers size={16} /> Quản lý trang
            </button>
          </div>
        )}

        {/* Shutter & Thumbnail Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 420 }}>
          {/* Batch review thumbnail button */}
          <div style={{ width: 56, height: 56, position: 'relative' }}>
            {committedPages.length > 0 ? (
              <button
                onClick={onOpenPageManager}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  border: '2px solid #3b82f6',
                  padding: 0,
                  overflow: 'hidden',
                  background: '#1e293b',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title="Xem danh sách trang đã quét"
              >
                {lastThumbnail && (
                  <img src={lastThumbnail} alt="Trang mới nhất" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <div className="badge-count">{committedPages.length}</div>
              </button>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary"
                style={{ width: 52, height: 52, borderRadius: 12, padding: 0 }}
                title="Tải ảnh từ máy (chọn nhiều ảnh)"
              >
                <Upload size={22} color="#94a3b8" />
              </button>
            )}
          </div>

          {/* Big Shutter Button */}
          <button
            onClick={handleCapture}
            disabled={!!cameraError || isLoading || isSavingContinuous}
            className="shutter-btn"
            style={{
              borderColor: scanMode === 'continuous' ? '#f59e0b' : scanMode === 'book' ? '#10b981' : '#3b82f6',
              boxShadow: scanMode === 'continuous' ? '0 0 25px rgba(245, 158, 11, 0.5)' : undefined
            }}
            aria-label="Chụp ảnh"
          />

          {/* Quick upload or Done button */}
          <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              style={{ width: 52, height: 52, borderRadius: 12, padding: 0 }}
              title="Chọn thêm ảnh từ máy"
            >
              <Upload size={20} color="#94a3b8" />
            </button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
          {scanMode === 'continuous'
            ? '⚡ Chế độ Quét liên tục: Chụp liên tiếp không dừng, tự động lưu từng trang vào tài liệu'
            : scanMode === 'book'
            ? 'Chế độ Sách: Tự động chia đôi trang Trái & Phải'
            : 'Chế độ 1 Trang: Chụp và chỉnh sửa 4 góc'}
        </p>
      </div>
    </div>
  );
};
