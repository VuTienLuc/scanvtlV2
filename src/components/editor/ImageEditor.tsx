import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  RotateCw,
  Crop,
  Sparkles,
  Check,
  Trash2,
  Undo,
  Eye,
  PenTool
} from 'lucide-react';
import type { Point, QuadCorners, FilterType, DrawingStroke } from '../../types/scanner';
import {
  getDefaultCorners,
  detectDocumentCorners,
  applyPerspectiveWarp,
  applyImageFilter,
  rotateCanvas,
  generateThumbnail
} from '../../services/cvService';
import { useToast } from '../common/Toast';

interface ImageEditorProps {
  sourceDataUrl: string;
  initialCorners?: QuadCorners;
  initialFilter?: FilterType;
  initialRotation?: 0 | 90 | 180 | 270;
  initialAnnotations?: DrawingStroke[];
  onCommit: (
    processedDataUrl: string,
    thumbnailDataUrl: string,
    cropCorners: QuadCorners,
    filter: FilterType,
    rotation: 0 | 90 | 180 | 270,
    annotations: DrawingStroke[],
    width: number,
    height: number
  ) => void;
  onDiscard: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  sourceDataUrl,
  initialCorners,
  initialFilter = 'clean',
  initialRotation = 0,
  initialAnnotations = [],
  onCommit,
  onDiscard
}) => {
  const { showToast } = useToast();

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // States
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<QuadCorners | null>(initialCorners || null);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(initialRotation);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('Đang xử lý...');

  // Mode: 'crop' (showing original + 4 corner handles) vs 'preview' (showing warped + filter + drawings)
  const [editorMode, setEditorMode] = useState<'crop' | 'preview'>('crop');

  // Drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [annotations, setAnnotations] = useState<DrawingStroke[]>(initialAnnotations);
  const [currentColor, setCurrentColor] = useState('#f43f5e'); // Red default
  const strokeWidth = 6;
  const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);

  // Active dragging handle ('topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | null)
  const [activeHandle, setActiveHandle] = useState<keyof QuadCorners | null>(null);

  // Load source image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImg(img);
      if (!corners) {
        setCorners(getDefaultCorners(img.width, img.height, 0.06));
      }
    };
    img.src = sourceDataUrl;
  }, [sourceDataUrl]);

  // Auto-detect corners with OpenCV
  const handleAutoDetect = async () => {
    if (!sourceImg) return;
    setIsProcessing(true);
    setProcessingMsg('AI đang tìm mép giấy...');
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sourceImg.width;
      tempCanvas.height = sourceImg.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(sourceImg, 0, 0);
        const detected = await detectDocumentCorners(tempCanvas);
        setCorners(detected);
        showToast('Đã phát hiện 4 góc tài liệu!', 'success');
      }
    } catch {
      showToast('Không phát hiện được góc rõ ràng, đặt về khung chuẩn.', 'info');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetCorners = () => {
    if (!sourceImg) return;
    setCorners(getDefaultCorners(sourceImg.width, sourceImg.height, 0.06));
    showToast('Đã đặt lại 4 góc chuẩn', 'info');
  };

  const handleRotate = () => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  };

  // Render warped document with selected filter
  const renderProcessedDocument = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!sourceImg || !corners) return null;

    // Step 1: Draw source image on canvas
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = sourceImg.width;
    srcCanvas.height = sourceImg.height;
    const sctx = srcCanvas.getContext('2d');
    if (!sctx) return null;
    sctx.drawImage(sourceImg, 0, 0);

    // Step 2: Perspective warp
    const warped = await applyPerspectiveWarp(srcCanvas, corners);

    // Step 3: Rotate if needed
    const rotated = rotateCanvas(warped, rotation);

    // Step 4: Apply filter
    const filtered = await applyImageFilter(rotated, filter);

    // Step 5: Render drawing annotations on top
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = filtered.width;
    finalCanvas.height = filtered.height;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return filtered;

    fctx.drawImage(filtered, 0, 0);

    // Draw user annotations
    for (const stroke of annotations) {
      if (stroke.points.length < 2) continue;
      fctx.beginPath();
      fctx.strokeStyle = stroke.color;
      fctx.lineWidth = stroke.width;
      fctx.lineCap = 'round';
      fctx.lineJoin = 'round';

      fctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        fctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      fctx.stroke();
    }

    return finalCanvas;
  }, [sourceImg, corners, rotation, filter, annotations]);

  // Redraw preview canvas when entering preview mode or changing filters/annotations
  useEffect(() => {
    if (editorMode !== 'preview') return;

    let isMounted = true;
    async function updatePreview() {
      setIsProcessing(true);
      setProcessingMsg('Đang áp dụng bộ lọc...');
      const canvas = await renderProcessedDocument();
      if (isMounted && canvas && previewCanvasRef.current) {
        const dest = previewCanvasRef.current;
        dest.width = canvas.width;
        dest.height = canvas.height;
        const dctx = dest.getContext('2d');
        dctx?.drawImage(canvas, 0, 0);
      }
      if (isMounted) setIsProcessing(false);
    }

    updatePreview();
    return () => {
      isMounted = false;
    };
  }, [editorMode, filter, rotation, annotations, renderProcessedDocument]);

  // Handle pointer dragging of corner handles
  const handlePointerDown = (handle: keyof QuadCorners) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveHandle(handle);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !sourceImg || !corners || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = sourceImg.width / rect.width;
    const scaleY = sourceImg.height / rect.height;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const clampedX = Math.max(0, Math.min(sourceImg.width, clientX * scaleX));
    const clampedY = Math.max(0, Math.min(sourceImg.height, clientY * scaleY));

    setCorners((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [activeHandle]: { x: clampedX, y: clampedY }
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      setActiveHandle(null);
    }
  };

  // Drawing mouse/touch handlers for Annotation
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    setCurrentStroke([{ x, y }]);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !currentStroke || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    setCurrentStroke((prev) => (prev ? [...prev, { x, y }] : null));

    // Live stroke draw on preview canvas
    const ctx = canvas.getContext('2d');
    if (ctx && currentStroke.length > 0) {
      const lastPoint = currentStroke[currentStroke.length - 1];
      ctx.beginPath();
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleCanvasPointerUp = () => {
    if (currentStroke && currentStroke.length > 1) {
      const newStroke: DrawingStroke = {
        id: `strk_${Date.now()}`,
        points: currentStroke,
        color: currentColor,
        width: strokeWidth
      };
      setAnnotations((prev) => [...prev, newStroke]);
    }
    setCurrentStroke(null);
  };

  const handleUndoAnnotation = () => {
    setAnnotations((prev) => prev.slice(0, prev.length - 1));
  };

  const handleClearAnnotations = () => {
    setAnnotations([]);
  };

  // Commit page
  const handleSaveAndCommit = async () => {
    setIsProcessing(true);
    setProcessingMsg('Đang hoàn thiện trang...');
    try {
      const finalCanvas = await renderProcessedDocument();
      if (!finalCanvas || !corners) {
        showToast('Không thể tạo trang hoàn chỉnh', 'error');
        return;
      }

      const processedDataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
      const thumbnailDataUrl = generateThumbnail(finalCanvas);

      onCommit(
        processedDataUrl,
        thumbnailDataUrl,
        corners,
        filter,
        rotation,
        annotations,
        finalCanvas.width,
        finalCanvas.height
      );
      showToast('Đã lưu trang thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu trang', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#090d16', display: 'flex', flexDirection: 'column', zIndex: 60 }}>
      {/* Top Header */}
      <div
        style={{
          height: 56,
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px'
        }}
      >
        <button onClick={onDiscard} className="btn btn-ghost" style={{ color: '#f43f5e' }}>
          <Trash2 size={18} /> Bỏ qua
        </button>

        {/* Mode Toggle: Chỉnh góc (Crop) vs Xem kết quả (Preview) */}
        <div style={{ display: 'flex', background: '#1e293b', borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setEditorMode('crop')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: editorMode === 'crop' ? '#3b82f6' : 'transparent',
              color: editorMode === 'crop' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Crop size={16} /> Chỉnh góc
          </button>
          <button
            onClick={() => setEditorMode('preview')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: editorMode === 'preview' ? '#3b82f6' : 'transparent',
              color: editorMode === 'preview' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Eye size={16} /> Xem kết quả
          </button>
        </div>

        <button onClick={handleRotate} className="btn btn-ghost" title="Xoay 90 độ">
          <RotateCw size={18} /> {rotation}°
        </button>
      </div>

      {/* Main Workspace Area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}
      >
        {isProcessing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(9, 13, 22, 0.85)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12
            }}
          >
            <div className="loader-spinner" />
            <p style={{ color: '#fff', fontWeight: 600 }}>{processingMsg}</p>
          </div>
        )}

        {editorMode === 'crop' ? (
          /* Mode 1: 4 Corner Quad Adjustment */
          sourceImg && corners && (
            <div
              ref={containerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '92%',
                maxHeight: '75vh',
                touchAction: 'none'
              }}
            >
              <img
                src={sourceDataUrl}
                alt="Bản scan gốc"
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  display: 'block',
                  borderRadius: 4,
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />

              {/* SVG polygon connecting 4 corners */}
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 20
                }}
                viewBox={`0 0 ${sourceImg.width} ${sourceImg.height}`}
              >
                <polygon
                  points={`${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3b82f6"
                  strokeWidth={Math.max(2, sourceImg.width / 350)}
                  strokeDasharray="6,4"
                />
              </svg>

              {/* 4 Draggable Interactive Corner Handles */}
              {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as Array<keyof QuadCorners>).map((handle) => {
                const pt = corners[handle];
                const pctX = (pt.x / sourceImg.width) * 100;
                const pctY = (pt.y / sourceImg.height) * 100;
                return (
                  <div
                    key={handle}
                    className="corner-handle"
                    style={{ left: `${pctX}%`, top: `${pctY}%` }}
                    onPointerDown={handlePointerDown(handle)}
                    title={`Kéo góc: ${handle}`}
                  />
                );
              })}
            </div>
          )
        ) : (
          /* Mode 2: Preview Warped & Filter & Annotations */
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
              ref={previewCanvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              style={{
                cursor: isDrawingMode ? 'crosshair' : 'default',
                touchAction: isDrawingMode ? 'none' : 'auto'
              }}
            />
          </div>
        )}
      </div>

      {/* Sub-toolbar (Crop actions or Filter / Drawing actions) */}
      <div
        style={{
          background: '#0f172a',
          borderTop: '1px solid #1e293b',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        {editorMode === 'crop' ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={handleAutoDetect} className="btn btn-secondary" style={{ fontSize: 13 }}>
              <Sparkles size={16} color="#3b82f6" /> Tự tìm 4 góc (AI)
            </button>
            <button onClick={handleResetCorners} className="btn btn-ghost" style={{ fontSize: 13 }}>
              Đặt lại góc chuẩn
            </button>
          </div>
        ) : (
          /* Filter & Draw Toolbar */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Filter buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, overflowX: 'auto' }}>
              {(
                [
                  { id: 'clean', label: 'Sạch nền', icon: '✨' },
                  { id: 'enhanced', label: 'Nét chữ', icon: '📄' },
                  { id: 'bw', label: 'Trắng đen', icon: '🌗' },
                  { id: 'original', label: 'Ảnh gốc', icon: '🖼️' }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: filter === f.id ? '#3b82f6' : '#334155',
                    background: filter === f.id ? 'rgba(59, 130, 246, 0.2)' : '#1e293b',
                    color: filter === f.id ? '#3b82f6' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}

              <div style={{ width: 1, height: 24, background: '#334155', margin: '0 4px' }} />

              {/* Drawing Mode Toggle Button */}
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: isDrawingMode ? '#f59e0b' : '#334155',
                  background: isDrawingMode ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                  color: isDrawingMode ? '#f59e0b' : '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <PenTool size={14} /> Chấm bài
              </button>
            </div>

            {/* Drawing Color & Undo Bar */}
            {isDrawingMode && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                {['#f43f5e', '#3b82f6', '#10b981', '#f59e0b'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setCurrentColor(color)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: color,
                      border: currentColor === color ? '2px solid #fff' : 'none',
                      cursor: 'pointer'
                    }}
                  />
                ))}

                <button onClick={handleUndoAnnotation} className="btn-ghost" style={{ padding: 4, cursor: 'pointer' }} title="Hoàn tác nét vẽ">
                  <Undo size={16} />
                </button>
                <button onClick={handleClearAnnotations} className="btn-ghost" style={{ padding: 4, cursor: 'pointer', fontSize: 12 }}>
                  Xóa hết nét
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Commit Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <button
            onClick={() => {
              if (editorMode === 'crop') setEditorMode('preview');
              else setEditorMode('crop');
            }}
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
          >
            {editorMode === 'crop' ? 'Xem trước nét' : 'Chỉnh lại 4 góc'}
          </button>

          <button
            onClick={handleSaveAndCommit}
            className="btn btn-primary"
            style={{ padding: '10px 24px', fontSize: 14 }}
          >
            <Check size={18} /> Lưu trang vào tài liệu
          </button>
        </div>
      </div>
    </div>
  );
};
