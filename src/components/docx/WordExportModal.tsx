import React, { useState } from 'react';
import { FileText, Download, X } from 'lucide-react';
import type { PageRecord, DOCXExportOptions } from '../../types/scanner';
import { docxService } from '../../services/docxService';
import { useToast } from '../common/Toast';

interface WordExportModalProps {
  pages: PageRecord[];
  onClose: () => void;
}

export const WordExportModal: React.FC<WordExportModalProps> = ({ pages, onClose }) => {
  const { showToast } = useToast();

  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

  const [filename, setFilename] = useState(`GiaoAn_TaiLieu_${dateStr}.docx`);
  const [mode, setMode] = useState<'image-based' | 'editable'>('editable');
  const [includeMathOMML, setIncludeMathOMML] = useState<boolean>(true);
  const [includeOriginalPageNumber, setIncludeOriginalPageNumber] = useState<boolean>(true);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const handleExport = async () => {
    setIsExporting(true);
    setProgressPct(5);
    setProgressMsg('Đang chuẩn bị dữ liệu Word...');

    try {
      const options: DOCXExportOptions = {
        mode,
        filename: filename.trim().endsWith('.docx') ? filename.trim() : `${filename.trim()}.docx`,
        includeMathOMML,
        includeOriginalPageNumber
      };

      const docxBlob = await docxService.generateDocx(pages, options, (pct, msg) => {
        setProgressPct(pct);
        setProgressMsg(msg);
      });

      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Đã xuất tệp Word (${options.filename}) thành công!`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Lỗi xuất tệp Word', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
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
          <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6' }}>
            <FileText size={22} color="#3b82f6" /> Xuất tài liệu Word (.docx)
          </h2>
          <button onClick={onClose} className="btn-ghost" disabled={isExporting}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filename Input */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Tên tệp Word:
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

          {/* Mode Selection Cards */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Chọn chế độ xuất:
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Option 1: Editable Mode */}
              <div
                onClick={() => setMode('editable')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid',
                  borderColor: mode === 'editable' ? '#3b82f6' : 'var(--border-default)',
                  background: mode === 'editable' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12
                }}
              >
                <input
                  type="radio"
                  name="wordMode"
                  checked={mode === 'editable'}
                  onChange={() => setMode('editable')}
                  style={{ marginTop: 3, accentColor: '#3b82f6' }}
                />
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block' }}>
                    DOCX Chỉnh sửa được (Khuyên dùng)
                  </strong>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Chuyển kết quả OCR thành văn bản Word có thể gõ, sửa, định dạng lại. Tự động chèn công thức Toán học chuẩn Office Math.
                  </p>
                </div>
              </div>

              {/* Option 2: Image-based Mode */}
              <div
                onClick={() => setMode('image-based')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid',
                  borderColor: mode === 'image-based' ? '#3b82f6' : 'var(--border-default)',
                  background: mode === 'image-based' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12
                }}
              >
                <input
                  type="radio"
                  name="wordMode"
                  checked={mode === 'image-based'}
                  onChange={() => setMode('image-based')}
                  style={{ marginTop: 3, accentColor: '#3b82f6' }}
                />
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block' }}>
                    DOCX Dạng ảnh (Bảo toàn hình thức 100%)
                  </strong>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Mỗi trang scan được chèn dưới dạng ảnh trang in sắc nét. (Lưu ý: Không chỉnh sửa trực tiếp ký tự).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Options for Editable mode */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="pageNumberToggle"
                checked={includeOriginalPageNumber}
                onChange={(e) => setIncludeOriginalPageNumber(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
              />
              <label htmlFor="pageNumberToggle" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Đánh số trang tài liệu Word
              </label>
            </div>

            {mode === 'editable' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="mathOmmlToggle"
                  checked={includeMathOMML}
                  onChange={(e) => setIncludeMathOMML(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <label htmlFor="mathOmmlToggle" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Chuyển công thức LaTeX sang công thức Office Math (.docx)
                </label>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {isExporting && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>{progressMsg}</span>
                <span style={{ fontWeight: 700 }}>{progressPct}%</span>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: '#3b82f6', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12
          }}
        >
          <button onClick={onClose} disabled={isExporting} className="btn btn-ghost">
            Hủy
          </button>

          <button onClick={handleExport} disabled={isExporting} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <Download size={18} /> Bắt đầu xuất Word
          </button>
        </div>
      </div>
    </div>
  );
};
