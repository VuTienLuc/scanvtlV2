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
  getStandardFormatCorners,
  getWholeImageCorners,
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

  // Crop shape preset: 'a4' | 'a5' | 'free' | 'full'
  const [cropShapeMode, setCropShapeMode] = useState<'a4' | 'a5' | 'free' | 'full'>('a4');
  // Paper orientation: default is ALWAYS portrait (false = dọc)
  const [isLandscapeOrientation, setIsLandscapeOrientation] = useState<boolean>(false);

  // Active dragging handle ('topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'center' | null)
  const [activeHandle, setActiveHandle] = useState<keyof QuadCorners | 'center' | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialCorners: QuadCorners } | null>(null);

  // Load source image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImg(img);
      if (!corners) {
        // Mặc định luôn là khổ DỌC (A4 portrait: 1 / 1.414)
        setCorners(getStandardFormatCorners(img.width, img.height, 'a4', false));
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

  const handleSnapStandard = (format: 'a4' | 'a5', landscape: boolean = isLandscapeOrientation) => {
    if (!sourceImg) return;
    const standardCorners = getStandardFormatCorners(sourceImg.width, sourceImg.height, format, landscape);
    setCorners(standardCorners);
    showToast(`Đã căn góc chuẩn ${format.toUpperCase()} (${landscape ? 'Khổ ngang ↔️' : 'Khổ dọc ↕️ (Mặc định)'})`, 'info', 1500);
  };

  const handleToggleOrientation = () => {
    if (!sourceImg) return;
    const nextLandscape = !isLandscapeOrientation;
    setIsLandscapeOrientation(nextLandscape);
    const targetFormat = cropShapeMode === 'a5' ? 'a5' : 'a4';
    const standardCorners = getStandardFormatCorners(sourceImg.width, sourceImg.height, targetFormat, nextLandscape);
    setCorners(standardCorners);
    showToast(`Đã chuyển sang ${targetFormat.toUpperCase()} ${nextLandscape ? 'Khổ Ngang ↔️' : 'Khổ Dọc ↕️ (Mặc định)'}`, 'info', 1500);
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

  // Handle pointer dragging of entire center frame
  const handleCenterPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!corners) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveHandle('center');
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialCorners: { ...corners }
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !sourceImg || !corners || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = sourceImg.width / rect.width;
    const scaleY = sourceImg.height / rect.height;

    // Moving the entire frame
    if (activeHandle === 'center' && dragStartRef.current) {
      const dx = (e.clientX - dragStartRef.current.clientX) * scaleX;
      const dy = (e.clientY - dragStartRef.current.clientY) * scaleY;
      const init = dragStartRef.current.initialCorners;

      const minX = Math.min(init.topLeft.x, init.bottomLeft.x);
      const maxX = Math.max(init.topRight.x, init.bottomRight.x);
      const minY = Math.min(init.topLeft.y, init.topRight.y);
      const maxY = Math.max(init.bottomLeft.y, init.bottomRight.y);

      const boundedDx = Math.max(-minX, Math.min(sourceImg.width - maxX, dx));
      const boundedDy = Math.max(-minY, Math.min(sourceImg.height - maxY, dy));

      setCorners({
        topLeft: { x: Math.round(init.topLeft.x + boundedDx), y: Math.round(init.topLeft.y + boundedDy) },
        topRight: { x: Math.round(init.topRight.x + boundedDx), y: Math.round(init.topRight.y + boundedDy) },
        bottomRight: { x: Math.round(init.bottomRight.x + boundedDx), y: Math.round(init.bottomRight.y + boundedDy) },
        bottomLeft: { x: Math.round(init.bottomLeft.x + boundedDx), y: Math.round(init.bottomLeft.y + boundedDy) }
      });
      return;
    }

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const clampedX = Math.max(0, Math.min(sourceImg.width, clientX * scaleX));
    const clampedY = Math.max(0, Math.min(sourceImg.height, clientY * scaleY));

    if (cropShapeMode === 'a4' || cropShapeMode === 'a5') {
      const ratio = isLandscapeOrientation ? 1.4142 : 1 / 1.4142;

      let anchorKey: keyof QuadCorners;
      if (activeHandle === 'bottomRight') anchorKey = 'topLeft';
      else if (activeHandle === 'topLeft') anchorKey = 'bottomRight';
      else if (activeHandle === 'bottomLeft') anchorKey = 'topRight';
      else anchorKey = 'bottomLeft';

      const anchor = corners[anchorKey];
      let newW = Math.abs(clampedX - anchor.x);
      let newH = newW / ratio;

      if (newH > sourceImg.height) {
        newH = sourceImg.height;
        newW = newH * ratio;
      }

      const signX = clampedX >= anchor.x ? 1 : -1;
      const signY = clampedY >= anchor.y ? 1 : -1;

      const targetX = Math.max(0, Math.min(sourceImg.width, anchor.x + signX * newW));
      const targetY = Math.max(0, Math.min(sourceImg.height, anchor.y + signY * newH));

      const minCornerX = Math.min(anchor.x, targetX);
      const maxCornerX = Math.max(anchor.x, targetX);
      const minCornerY = Math.min(anchor.y, targetY);
      const maxCornerY = Math.max(anchor.y, targetY);

      setCorners({
        topLeft: { x: Math.round(minCornerX), y: Math.round(minCornerY) },
        topRight: { x: Math.round(maxCornerX), y: Math.round(minCornerY) },
        bottomRight: { x: Math.round(maxCornerX), y: Math.round(maxCornerY) },
        bottomLeft: { x: Math.round(minCornerX), y: Math.round(maxCornerY) }
      });
    } else {
      setCorners((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [activeHandle]: { x: Math.round(clampedX), y: Math.round(clampedY) }
        };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      setActiveHandle(null);
      dragStartRef.current = null;
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

              {/* SVG polygon connecting 4 corners with mask & grid */}
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
                {/* SVG definitions for mask */}
                <defs>
                  <mask id="cropVignetteMask">
                    <rect width="100%" height="100%" fill="white" />
                    <polygon
                      points={`${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`}
                      fill="black"
                    />
                  </mask>
                </defs>

                {/* Darkened mask outside crop box */}
                <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.65)" mask="url(#cropVignetteMask)" />

                {/* 3x3 Grid lines inside crop box */}
                <line
                  x1={corners.topLeft.x + (corners.bottomLeft.x - corners.topLeft.x) / 3}
                  y1={corners.topLeft.y + (corners.bottomLeft.y - corners.topLeft.y) / 3}
                  x2={corners.topRight.x + (corners.bottomRight.x - corners.topRight.x) / 3}
                  y2={corners.topRight.y + (corners.bottomRight.y - corners.topRight.y) / 3}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
                <line
                  x1={corners.topLeft.x + 2 * (corners.bottomLeft.x - corners.topLeft.x) / 3}
                  y1={corners.topLeft.y + 2 * (corners.bottomLeft.y - corners.topLeft.y) / 3}
                  x2={corners.topRight.x + 2 * (corners.bottomRight.x - corners.topRight.x) / 3}
                  y2={corners.topRight.y + 2 * (corners.bottomRight.y - corners.topRight.y) / 3}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
                <line
                  x1={corners.topLeft.x + (corners.topRight.x - corners.topLeft.x) / 3}
                  y1={corners.topLeft.y + (corners.topRight.y - corners.topLeft.y) / 3}
                  x2={corners.bottomLeft.x + (corners.bottomRight.x - corners.bottomLeft.x) / 3}
                  y2={corners.bottomLeft.y + (corners.bottomRight.y - corners.bottomLeft.y) / 3}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
                <line
                  x1={corners.topLeft.x + 2 * (corners.topRight.x - corners.topLeft.x) / 3}
                  y1={corners.topLeft.y + 2 * (corners.topRight.y - corners.topLeft.y) / 3}
                  x2={corners.bottomLeft.x + 2 * (corners.bottomRight.x - corners.bottomLeft.x) / 3}
                  y2={corners.bottomLeft.y + 2 * (corners.bottomRight.y - corners.bottomLeft.y) / 3}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />

                {/* Main active crop boundary polygon */}
                <polygon
                  points={`${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`}
                  fill={cropShapeMode === 'a4' ? 'rgba(16, 185, 129, 0.12)' : cropShapeMode === 'a5' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.15)'}
                  stroke={cropShapeMode === 'a4' ? '#10b981' : cropShapeMode === 'a5' ? '#f59e0b' : '#3b82f6'}
                  strokeWidth={Math.max(3, sourceImg.width / 260)}
                  strokeDasharray={cropShapeMode === 'free' ? '6,4' : undefined}
                  style={{ pointerEvents: 'auto', cursor: 'move' }}
                  onPointerDown={handleCenterPointerDown}
                />
              </svg>

              {/* Floating Badge on top of crop polygon */}
              <div
                style={{
                  position: 'absolute',
                  left: `${((corners.topLeft.x + corners.topRight.x) / (2 * sourceImg.width)) * 100}%`,
                  top: `${(Math.min(corners.topLeft.y, corners.topRight.y) / sourceImg.height) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                  background: cropShapeMode === 'a4' ? 'rgba(16, 185, 129, 0.95)' : cropShapeMode === 'a5' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(30, 41, 59, 0.95)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 12px',
                  borderRadius: 9999,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 25,
                  letterSpacing: '0.5px'
                }}
              >
                {cropShapeMode === 'a4'
                  ? `📄 KHUNG A4 ${isLandscapeOrientation ? 'NGANG (1.414 : 1)' : 'DỌC CHUẨN (1 : 1.414)'}`
                  : cropShapeMode === 'a5'
                  ? `📘 KHUNG A5 ${isLandscapeOrientation ? 'NGANG' : 'DỌC CHUẨN'}`
                  : cropShapeMode === 'full'
                  ? '🖼️ TOÀN BỘ ẢNH'
                  : '📐 KHUNG TỰ DO (4 GÓC)'}
              </div>

              {/* 4 Draggable Interactive Corner Handles */}
              {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as Array<keyof QuadCorners>).map((handle) => {
                const pt = corners[handle];
                const pctX = (pt.x / sourceImg.width) * 100;
                const pctY = (pt.y / sourceImg.height) * 100;
                const handleColor = cropShapeMode === 'a4' ? '#10b981' : cropShapeMode === 'a5' ? '#f59e0b' : '#3b82f6';
                return (
                  <div
                    key={handle}
                    style={{
                      position: 'absolute',
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      touchAction: 'none',
                      zIndex: 25
                    }}
                    onPointerDown={handlePointerDown(handle)}
                    title={`Kéo góc: ${handle}`}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: `4px solid ${handleColor}`,
                        boxShadow: `0 0 12px ${handleColor}`
                      }}
                    />
                  </div>
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

      {/* Smart Bottom Control Center */}
      <div
        style={{
          background: '#090d16',
          borderTop: '1px solid #1e293b',
          padding: '10px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 30
        }}
      >
        {editorMode === 'crop' ? (
          <>
            {/* Row 1: Smart Shape Mode Segmented Tabs */}
            <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.8)', borderRadius: 10, padding: 3, gap: 2 }}>
              <button
                onClick={() => {
                  setCropShapeMode('a4');
                  handleSnapStandard('a4');
                }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: cropShapeMode === 'a4' ? '#10b981' : 'transparent',
                  color: cropShapeMode === 'a4' ? '#fff' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                📄 Khung A4
              </button>

              <button
                onClick={() => {
                  setCropShapeMode('a5');
                  handleSnapStandard('a5');
                }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: cropShapeMode === 'a5' ? '#f59e0b' : 'transparent',
                  color: cropShapeMode === 'a5' ? '#fff' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                📘 Khung A5
              </button>

              <button
                onClick={() => {
                  setCropShapeMode('free');
                  showToast('Chế độ Tự do: Kéo độc lập 4 góc theo ý muốn', 'info', 1200);
                }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: cropShapeMode === 'free' ? '#3b82f6' : 'transparent',
                  color: cropShapeMode === 'free' ? '#fff' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                📐 Tự Do
              </button>

              <button
                onClick={() => {
                  setCropShapeMode('full');
                  if (sourceImg) {
                    setCorners(getWholeImageCorners(sourceImg.width, sourceImg.height));
                    showToast('Đã chọn toàn bộ ảnh', 'info', 1200);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: cropShapeMode === 'full' ? '#6366f1' : 'transparent',
                  color: cropShapeMode === 'full' ? '#fff' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                🖼️ Toàn Bộ
              </button>
            </div>

            {/* Row 2: Smart Detection, Orientation Toggle & Centering Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <button
                onClick={handleAutoDetect}
                className="btn btn-secondary"
                style={{ flex: 1.1, padding: '8px 10px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                title="Tự động phát hiện mép sách/tài liệu"
              >
                <Sparkles size={14} color="#38bdf8" /> ✨ AI Mép Sách
              </button>

              <button
                onClick={handleToggleOrientation}
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  padding: '8px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: isLandscapeOrientation ? '#f59e0b' : '#34d399',
                  background: isLandscapeOrientation ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: isLandscapeOrientation ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
                title={isLandscapeOrientation ? 'Khổ Ngang - Bấm để chuyển về Khổ Dọc (Mặc định)' : 'Khổ Dọc (Mặc định) - Bấm để chuyển sang Khổ Ngang'}
              >
                {isLandscapeOrientation ? '↔️ Khổ Ngang' : '↕️ Khổ Dọc'}
              </button>

              <button
                onClick={() => handleSnapStandard(cropShapeMode === 'a5' ? 'a5' : 'a4')}
                className="btn btn-ghost"
                style={{ flex: 0.8, padding: '8px 8px', fontSize: 12, color: '#94a3b8', background: 'rgba(30, 41, 59, 0.5)', borderRadius: 8, textAlign: 'center' }}
                title="Đặt lại khung về giữa ảnh"
              >
                Căn Giữa
              </button>

              <button
                onClick={handleRotate}
                className="btn btn-ghost"
                style={{ flex: 0.8, padding: '8px 8px', fontSize: 12, color: '#94a3b8', background: 'rgba(30, 41, 59, 0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                title="Xoay ảnh 90 độ"
              >
                <RotateCw size={13} /> Xoay 90°
              </button>
            </div>

            {/* Hint text */}
            <p style={{ margin: 0, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
              💡 Chạm giữ bên trong khung để di chuyển • Kéo 4 góc tròn để phóng to / thu nhỏ
            </p>
          </>
        ) : (
          /* Filter & Draw Toolbar */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Filter buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, overflowX: 'auto' }}>
              {(
                [
                  { id: 'ai_sharp', label: 'Nét AI', icon: '🤖' },
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

        {/* Row 3: Action Commit Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <button
            onClick={() => {
              if (editorMode === 'crop') setEditorMode('preview');
              else setEditorMode('crop');
            }}
            className="btn btn-secondary"
            style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {editorMode === 'crop' ? <><Eye size={16} /> Xem trước nét</> : <><Crop size={16} /> Chỉnh lại góc</>}
          </button>

          <button
            onClick={handleSaveAndCommit}
            className="btn btn-primary"
            style={{
              flex: 1,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Check size={18} /> Lưu trang vào tài liệu
          </button>
        </div>
      </div>
    </div>
  );
};
