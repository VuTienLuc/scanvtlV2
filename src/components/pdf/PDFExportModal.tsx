import React, { useState } from 'react';
import { Download, Share2, X, FileText } from 'lucide-react';
import type { PageRecord, PDFExportOptions } from '../../types/scanner';
import { pdfService } from '../../services/pdfService';
import { useToast } from '../common/Toast';

interface PDFExportModalProps {
  pages: PageRecord[];
  onClose: () => void;
}

export const PDFExportModal: React.FC<PDFExportModalProps> = ({ pages, onClose }) => {
  const { showToast } = useToast();

  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

  const [filename, setFilename] = useState(`TaiLieu_GiaoAn_${dateStr}.pdf`);
  const [pageSize, setPageSize] = useState<'a4' | 'a5' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'auto'>('auto');
  const [quality, setQuality] = useState<0.3 | 0.6 | 0.85 | 1.0>(0.85);
  const [marginMm, setMarginMm] = useState<number>(5);
  const [includeSearchableText, setIncludeSearchableText] = useState<boolean>(true);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');

  const handleDownload = async () => {
    setIsExporting(true);
    setExportProgress(5);
    setExportStatusText('Đang khởi tạo PDF...');

    try {
      const options: PDFExportOptions = {
        pageSize,
        orientation,
        quality,
        marginMm,
        filename: filename.trim().endsWith('.pdf') ? filename.trim() : `${filename.trim()}.pdf`,
        includeSearchableText
      };

      const pdfBytes = await pdfService.generatePDF(pages, options, (pct, msg) => {
        setExportProgress(pct);
        setExportStatusText(msg);
      });

      // Save blob and trigger download
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Đã xuất và tải về ${options.filename}!`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tạo PDF.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    setExportProgress(5);
    setExportStatusText('Đang chuẩn bị tệp PDF...');

    try {
      const options: PDFExportOptions = {
        pageSize,
        orientation,
        quality,
        marginMm,
        filename: filename.trim().endsWith('.pdf') ? filename.trim() : `${filename.trim()}.pdf`,
        includeSearchableText
      };

      const pdfBytes = await pdfService.generatePDF(pages, options, (pct, msg) => {
        setExportProgress(pct);
        setExportStatusText(msg);
      });

      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const file = new File([blob], options.filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: options.filename,
          text: `Gửi bạn tệp tài liệu PDF gồm ${pages.length} trang vừa scan.`,
          files: [file]
        });
        showToast('Chia sẻ PDF thành công!', 'success');
        onClose();
      } else {
        showToast('Thiết bị không hỗ trợ chia sẻ trực tiếp. Đang chuyển sang tải về...', 'info');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = options.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(err.message || 'Lỗi khi chia sẻ.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} color="#3b82f6" /> Xuất tệp PDF ({pages.length} trang)
          </h2>
          <button onClick={onClose} className="btn-ghost" disabled={isExporting}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filename input */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Tên tệp PDF:
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                outline: 'none'
              }}
            />
          </div>

          {/* Page size & orientation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Khổ giấy:
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                <option value="a4">Khổ A4 (Chuẩn phổ biến)</option>
                <option value="a5">Khổ A5 (Sách nhỏ / Giáo trình)</option>
                <option value="letter">Khổ Letter</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Hướng trang:
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                <option value="auto">Tự động theo ảnh</option>
                <option value="portrait">Dọc (Portrait)</option>
                <option value="landscape">Ngang (Landscape)</option>
              </select>
            </div>
          </div>

          {/* Quality & Margins */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Chất lượng / Nén ảnh:
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value) as any)}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                <option value="0.85">Chất lượng cao (Khuyên dùng - 85%)</option>
                <option value="0.6">Vừa (Nén nhẹ gửi Zalo/Mail - 60%)</option>
                <option value="0.3">Siêu nén (Dung lượng nhỏ nhất - 30%)</option>
                <option value="1.0">Gốc (Không nén - 100%)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Lề trang:
              </label>
              <select
                value={marginMm}
                onChange={(e) => setMarginMm(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                <option value="0">Không có lề (0mm)</option>
                <option value="5">Lề hẹp (5mm)</option>
                <option value="10">Lề tiêu chuẩn (10mm)</option>
                <option value="15">Lề rộng (15mm)</option>
              </select>
            </div>
          </div>

          {/* Searchable PDF Option */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)'
            }}
          >
            <input
              type="checkbox"
              id="searchablePdfToggle"
              checked={includeSearchableText}
              onChange={(e) => setIncludeSearchableText(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            <label htmlFor="searchablePdfToggle" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <strong>Tạo PDF tìm kiếm (Searchable PDF)</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Nhúng lớp chữ OCR ẩn để có thể bôi đen, sao chép và tìm kiếm từ (Ctrl+F)
              </div>
            </label>
          </div>

          {/* Export Progress Bar */}
          {isExporting && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>{exportStatusText}</span>
                <span style={{ fontWeight: 700 }}>{exportProgress}%</span>
              </div>
              <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${exportProgress}%`,
                    background: 'var(--accent-blue)',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="btn btn-primary"
              style={{ flex: 1, padding: '12px 0' }}
            >
              <Download size={18} /> Lưu về máy
            </button>

            <button
              onClick={handleShare}
              disabled={isExporting}
              className="btn btn-emerald"
              style={{ flex: 1, padding: '12px 0' }}
            >
              <Share2 size={18} /> Chia sẻ file
            </button>
          </div>

          <button onClick={onClose} disabled={isExporting} className="btn btn-ghost" style={{ fontSize: 13 }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
