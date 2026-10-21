import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  RotateCw,
  Copy,
  Crop,
  ArrowLeft,
  Download,
  Type,
  Sigma,
  Wrench,
  Undo2,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import type { PageRecord } from '../../types/scanner';
import { rotateCanvas, generateThumbnail } from '../../services/cvService';
import { useToast } from '../common/Toast';

interface PageManagerProps {
  pages: PageRecord[];
  onUpdatePages: (updatedPages: PageRecord[]) => void;
  onAddMorePages: () => void;
  onReCropPage: (page: PageRecord) => void;
  onOpenExportPDF: () => void;
  onOpenExportWord: () => void;
  onOpenTextOCR: (page: PageRecord) => void;
  onOpenMathOCR: (page: PageRecord) => void;
  onOpenPDFTools: () => void;
  onBackToScanner: () => void;
}

export const PageManager: React.FC<PageManagerProps> = ({
  pages,
  onUpdatePages,
  onAddMorePages,
  onReCropPage,
  onOpenExportPDF,
  onOpenExportWord,
  onOpenTextOCR,
  onOpenMathOCR,
  onOpenPDFTools,
  onBackToScanner
}) => {
  const { showToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletedCache, setDeletedCache] = useState<{ index: number; page: PageRecord } | null>(null);
  const [previewPage, setPreviewPage] = useState<PageRecord | null>(null);

  // Estimate document size (approx 180KB - 400KB per page depending on filter)
  const estimatedSizeMb = ((pages.length * 280) / 1024).toFixed(1);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === pages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pages.map((p) => p.id));
    }
  };

  // Move page up/down in order
  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const newPages = [...pages];
    const temp = newPages[index];
    newPages[index] = newPages[targetIndex];
    newPages[targetIndex] = temp;

    // Re-index page numbers
    const updated = newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1, updatedAt: Date.now() }));
    onUpdatePages(updated);
  };

  // Delete page with undo support
  const handleDeletePage = (id: string) => {
    const idx = pages.findIndex((p) => p.id === id);
    if (idx === -1) return;

    const pageToDelete = pages[idx];
    setDeletedCache({ index: idx, page: pageToDelete });

    const remaining = pages.filter((p) => p.id !== id).map((p, i) => ({ ...p, pageNumber: i + 1 }));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    onUpdatePages(remaining);

    showToast(`Đã xóa trang ${idx + 1}.`, 'info');
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (!deletedCache) return;
    const newPages = [...pages];
    newPages.splice(deletedCache.index, 0, deletedCache.page);
    const updated = newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    onUpdatePages(updated);
    setDeletedCache(null);
    showToast('Đã khôi phục trang thành công!', 'success');
  };

  // Duplicate page
  const handleDuplicatePage = (page: PageRecord) => {
    const newPage: PageRecord = {
      ...page,
      id: `page_${Date.now()}_dup`,
      pageNumber: pages.length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    onUpdatePages([...pages, newPage]);
    showToast(`Đã nhân bản trang ${page.pageNumber}.`, 'success');
  };

  // Rotate single page 90 degrees
  const handleRotateSinglePage = async (page: PageRecord) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const rotated = rotateCanvas(canvas, 90);
      const newProcessed = rotated.toDataURL('image/jpeg', 0.9);
      const newThumb = generateThumbnail(rotated);

      const nextRotation = ((page.rotation + 90) % 360) as 0 | 90 | 180 | 270;

      const updated = pages.map((p) =>
        p.id === page.id
          ? {
              ...p,
              processedImage: newProcessed,
              thumbnail: newThumb,
              rotation: nextRotation,
              width: rotated.width,
              height: rotated.height,
              updatedAt: Date.now()
            }
          : p
      );
      onUpdatePages(updated);
      showToast(`Đã xoay trang ${page.pageNumber} 90°`, 'info');
    };
    img.src = page.processedImage;
  };

  // Delete selected pages
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const remaining = pages.filter((p) => !selectedIds.includes(p.id)).map((p, i) => ({ ...p, pageNumber: i + 1 }));
    setSelectedIds([]);
    onUpdatePages(remaining);
    showToast(`Đã xóa ${selectedIds.length} trang được chọn.`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBackToScanner} className="btn btn-ghost" title="Quay lại Camera">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Quản lý tài liệu ({pages.length} trang)
            </h1>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Ước tính dung lượng: ~{estimatedSizeMb} MB
            </span>
          </div>
        </div>

        {/* Quick Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {deletedCache && (
            <button onClick={handleUndoDelete} className="btn btn-secondary" style={{ color: '#10b981' }}>
              <Undo2 size={16} /> Hoàn tác xóa
            </button>
          )}

          <button onClick={onAddMorePages} className="btn btn-secondary">
            <Plus size={16} /> Thêm trang
          </button>

          <button onClick={onOpenExportPDF} disabled={pages.length === 0} className="btn btn-primary">
            <Download size={16} /> Xuất PDF
          </button>

          <button onClick={onOpenExportWord} disabled={pages.length === 0} className="btn btn-secondary" style={{ color: '#3b82f6' }}>
            <FileText size={16} /> Xuất Word
          </button>

          <button onClick={onOpenPDFTools} className="btn btn-ghost" title="Công cụ gộp/tách PDF">
            <Wrench size={16} />
          </button>
        </div>
      </header>

      {/* Batch Select & Bulk Operations Bar */}
      {pages.length > 0 && (
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleSelectAll}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {selectedIds.length === pages.length ? <CheckSquare size={18} color="#3b82f6" /> : <Square size={18} />}
              {selectedIds.length === pages.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
            {selectedIds.length > 0 && (
              <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>
                (Đã chọn {selectedIds.length} trang)
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDeleteSelected} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                <Trash2 size={14} /> Xóa {selectedIds.length} trang
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Pages Grid */}
      <main style={{ flex: 1, padding: 20 }}>
        {pages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center'
            }}
          >
            <FileText size={64} color="#64748b" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              Chưa có trang tài liệu nào
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 380, marginBottom: 24 }}>
              Hãy bấm vào nút bên dưới để mở máy ảnh hoặc tải ảnh tài liệu, giáo án từ thiết bị của bạn.
            </p>
            <button onClick={onAddMorePages} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>
              <Plus size={20} /> Bắt đầu quét trang mới
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 20
            }}
          >
            {pages.map((page, index) => {
              const isSelected = selectedIds.includes(page.id);
              return (
                <div
                  key={page.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-md)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Card Header & Page Number */}
                  <div
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface-elevated)',
                      borderBottom: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handleToggleSelect(page.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
                        title="Chọn trang"
                      >
                        {isSelected ? <CheckSquare size={18} color="#3b82f6" /> : <Square size={18} color="#94a3b8" />}
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Trang {index + 1}
                      </span>
                    </div>

                    {/* Move Up / Down Buttons */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleMovePage(index, 'up')}
                        disabled={index === 0}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          color: index === 0 ? 'var(--text-muted)' : 'var(--text-secondary)'
                        }}
                        title="Di chuyển lên trước"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMovePage(index, 'down')}
                        disabled={index === pages.length - 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: index === pages.length - 1 ? 'not-allowed' : 'pointer',
                          color: index === pages.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)'
                        }}
                        title="Di chuyển ra sau"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Image View */}
                  <div
                    onClick={() => setPreviewPage(page)}
                    style={{
                      height: 250,
                      background: '#090d16',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 8,
                      cursor: 'zoom-in',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={page.thumbnail || page.processedImage}
                      alt={`Trang ${index + 1}`}
                      style={{
                        maxHeight: '100%',
                        maxWidth: '100%',
                        objectFit: 'contain',
                        borderRadius: 4,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                      }}
                    />
                    {page.ocrData && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 12,
                          background: 'rgba(59, 130, 246, 0.9)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4
                        }}
                      >
                        OCR ĐÃ QUÉT
                      </span>
                    )}
                  </div>

                  {/* Per-Page Action Toolbar */}
                  <div
                    style={{
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface-elevated)',
                      borderTop: '1px solid var(--border-subtle)',
                      gap: 4
                    }}
                  >
                    <button
                      onClick={() => onReCropPage(page)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title="Chỉnh lại 4 góc / Cắt ảnh"
                    >
                      <Crop size={16} />
                    </button>

                    <button
                      onClick={() => handleRotateSinglePage(page)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title="Xoay 90 độ"
                    >
                      <RotateCw size={16} />
                    </button>

                    <button
                      onClick={() => onOpenTextOCR(page)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, cursor: 'pointer', color: '#3b82f6' }}
                      title="Quét chữ OCR trang này"
                    >
                      <Type size={16} />
                    </button>

                    <button
                      onClick={() => onOpenMathOCR(page)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, cursor: 'pointer', color: '#10b981' }}
                      title="OCR Công thức Toán học"
                    >
                      <Sigma size={16} />
                    </button>

                    <button
                      onClick={() => handleDuplicatePage(page)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title="Nhân bản trang này"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      onClick={() => handleDeletePage(page.id)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, cursor: 'pointer', color: '#f43f5e' }}
                      title="Xóa trang này"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Fullscreen Zoom Preview Modal */}
      {previewPage && (
        <div className="modal-overlay" onClick={() => setPreviewPage(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 800, maxHeight: '92vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-default)'
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Chi tiết Trang {previewPage.pageNumber} ({previewPage.width} x {previewPage.height}px)
              </h3>
              <button onClick={() => setPreviewPage(null)} className="btn-ghost">
                ✕
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                justifyContent: 'center',
                background: '#090d16'
              }}
            >
              <img
                src={previewPage.processedImage}
                alt={`Chi tiết Trang ${previewPage.pageNumber}`}
                style={{ maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
