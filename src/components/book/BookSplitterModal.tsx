import React, { useState, useEffect } from 'react';
import { BookOpen, Check, Trash2 } from 'lucide-react';
import { splitBookPages, generateThumbnail, getDefaultCorners } from '../../services/cvService';
import { useToast } from '../common/Toast';
import type { PageRecord } from '../../types/scanner';

interface BookSplitterModalProps {
  sourceDataUrl: string;
  captureId: string;
  onCommitPages: (pages: PageRecord[]) => void;
  onDiscard: () => void;
}

export const BookSplitterModal: React.FC<BookSplitterModalProps> = ({
  sourceDataUrl,
  captureId,
  onCommitPages,
  onDiscard
}) => {
  const { showToast } = useToast();
  const [spineRatio, setSpineRatio] = useState<number>(0.5);
  const [leftThumb, setLeftThumb] = useState<string>('');
  const [rightThumb, setRightThumb] = useState<string>('');
  const [leftFull, setLeftFull] = useState<string>('');
  const [rightFull, setRightFull] = useState<string>('');
  const [pageDims, setPageDims] = useState<{ leftW: number; leftH: number; rightW: number; rightH: number }>({
    leftW: 0,
    leftH: 0,
    rightW: 0,
    rightH: 0
  });

  // Re-split image when spineRatio changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const ctx = srcCanvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const { leftCanvas, rightCanvas } = splitBookPages(srcCanvas, spineRatio);

      const lData = leftCanvas.toDataURL('image/jpeg', 0.9);
      const rData = rightCanvas.toDataURL('image/jpeg', 0.9);
      const lThumb = generateThumbnail(leftCanvas);
      const rThumb = generateThumbnail(rightCanvas);

      setLeftFull(lData);
      setRightFull(rData);
      setLeftThumb(lThumb);
      setRightThumb(rThumb);
      setPageDims({
        leftW: leftCanvas.width,
        leftH: leftCanvas.height,
        rightW: rightCanvas.width,
        rightH: rightCanvas.height
      });
    };
    img.src = sourceDataUrl;
  }, [sourceDataUrl, spineRatio]);

  const handleConfirmSplit = () => {
    if (!leftFull || !rightFull) {
      showToast('Đang xử lý ảnh, vui lòng đợi giây lát.', 'error');
      return;
    }

    const timestamp = Date.now();
    const leftPage: PageRecord = {
      id: `page_${timestamp}_L`,
      captureId,
      sourceImage: leftFull,
      processedImage: leftFull,
      thumbnail: leftThumb,
      cropCorners: getDefaultCorners(pageDims.leftW, pageDims.leftH),
      rotation: 0,
      filter: 'clean',
      annotations: [],
      status: 'committed',
      pageNumber: 1, // Will be ordered in PageManager
      width: pageDims.leftW,
      height: pageDims.leftH,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const rightPage: PageRecord = {
      id: `page_${timestamp}_R`,
      captureId,
      sourceImage: rightFull,
      processedImage: rightFull,
      thumbnail: rightThumb,
      cropCorners: getDefaultCorners(pageDims.rightW, pageDims.rightH),
      rotation: 0,
      filter: 'clean',
      annotations: [],
      status: 'committed',
      pageNumber: 2,
      width: pageDims.rightW,
      height: pageDims.rightH,
      createdAt: timestamp + 1,
      updatedAt: timestamp + 1
    };

    onCommitPages([leftPage, rightPage]);
    showToast('Đã tách thành công 2 trang sách (Trái & Phải)!', 'success');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#090d16', zIndex: 65, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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
          <Trash2 size={18} /> Hủy bỏ cả 2 trang
        </button>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={20} color="#10b981" /> Tách 2 trang sách
        </h3>

        <button onClick={handleConfirmSplit} className="btn btn-emerald">
          <Check size={18} /> Xác nhận lưu 2 trang
        </button>
      </div>

      {/* Workspace Preview */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          overflowY: 'auto'
        }}
      >
        {/* Dual Page Side-by-Side Preview */}
        <div style={{ display: 'flex', gap: 16, maxWidth: 900, width: '100%', justifyContent: 'center' }}>
          {/* Left Page Card */}
          <div
            style={{
              flex: 1,
              background: '#1e293b',
              borderRadius: 12,
              border: '2px solid #3b82f6',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: '#3b82f6', marginBottom: 8 }}>
              📖 TRANG TRÁI
            </div>
            {leftThumb && (
              <img
                src={leftThumb}
                alt="Trang Trái"
                style={{ width: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 6, background: '#fff' }}
              />
            )}
          </div>

          {/* Right Page Card */}
          <div
            style={{
              flex: 1,
              background: '#1e293b',
              borderRadius: 12,
              border: '2px solid #10b981',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: '#10b981', marginBottom: 8 }}>
              📖 TRANG PHẢI
            </div>
            {rightThumb && (
              <img
                src={rightThumb}
                alt="Trang Phải"
                style={{ width: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 6, background: '#fff' }}
              />
            )}
          </div>
        </div>

        {/* Spine Divider Adjustment Slider */}
        <div
          style={{
            marginTop: 20,
            background: '#1e293b',
            padding: '12px 24px',
            borderRadius: 12,
            border: '1px solid #334155',
            width: '100%',
            maxWidth: 500
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
            <span>Đường gáy sách:</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>{Math.round(spineRatio * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="0.7"
            step="0.01"
            value={spineRatio}
            onChange={(e) => setSpineRatio(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
            <span>Lệch trái (30%)</span>
            <span>Chính giữa (50%)</span>
            <span>Lệch phải (70%)</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
          💡 Kéo thanh trượt để căn đường gáy giữa hai trang sách. Cả 2 trang sẽ được lưu riêng biệt và có thể chỉnh sửa lại.
        </p>
      </div>
    </div>
  );
};
