import React, { useState, useRef } from 'react';
import { Wrench, Combine, Split, RotateCw, Upload, X, FileText } from 'lucide-react';
import { pdfService } from '../../services/pdfService';
import { useToast } from '../common/Toast';

interface PDFToolsStudioProps {
  onClose: () => void;
}

export const PDFToolsStudio: React.FC<PDFToolsStudioProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'merge' | 'split' | 'rotate'>('merge');

  // Merge state
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  // Split state
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitPagesInput, setSplitPagesInput] = useState<string>('1, 2-3');

  // Rotate state
  const [rotateFile, setRotateFile] = useState<File | null>(null);
  const [rotatePagesInput, setRotatePagesInput] = useState<string>('1');
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);

  const [isProcessing, setIsProcessing] = useState(false);

  // Merge Handler
  const handleMergePDFs = async () => {
    if (mergeFiles.length < 2) {
      showToast('Vui lòng chọn ít nhất 2 tệp PDF để gộp.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const byteArrays: Uint8Array[] = [];
      for (const file of mergeFiles) {
        const buffer = await file.arrayBuffer();
        byteArrays.push(new Uint8Array(buffer));
      }

      const mergedBytes = await pdfService.mergePDFs(byteArrays);
      const blob = new Blob([mergedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TaiLieu_Gop_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Đã gộp các tệp PDF thành công!', 'success');
      setMergeFiles([]);
    } catch (err: any) {
      showToast(err.message || 'Lỗi gộp PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Split Handler
  const handleSplitPDF = async () => {
    if (!splitFile) {
      showToast('Vui lòng chọn một tệp PDF để tách.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const buffer = await splitFile.arrayBuffer();
      const pdfBytes = new Uint8Array(buffer);

      // Parse comma-separated page ranges (e.g. "1, 2-4") into 0-based indices
      const indices: number[] = [];
      const parts = splitPagesInput.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
              if (i >= 1) indices.push(i - 1);
            }
          }
        } else {
          const p = parseInt(trimmed, 10);
          if (!isNaN(p) && p >= 1) {
            indices.push(p - 1);
          }
        }
      }

      if (indices.length === 0) {
        showToast('Vui lòng nhập số trang hợp lệ (ví dụ: 1, 3-5).', 'error');
        return;
      }

      const splitBytes = await pdfService.splitPDF(pdfBytes, Array.from(new Set(indices)));
      const blob = new Blob([splitBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tach_${splitFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Đã tách trang PDF thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tách PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Rotate Handler
  const handleRotatePDF = async () => {
    if (!rotateFile) {
      showToast('Vui lòng chọn một tệp PDF để xoay.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const buffer = await rotateFile.arrayBuffer();
      const pdfBytes = new Uint8Array(buffer);

      const indices: number[] = [];
      const parts = rotatePagesInput.split(',');
      for (const part of parts) {
        const p = parseInt(part.trim(), 10);
        if (!isNaN(p) && p >= 1) {
          indices.push(p - 1);
        }
      }

      const rotatedBytes = await pdfService.rotatePDFPages(pdfBytes, indices, rotateAngle);
      const blob = new Blob([rotatedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Xoay_${rotateFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Đã xoay các trang PDF thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi xoay PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
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
            <Wrench size={20} color="#3b82f6" /> Bộ công cụ PDF (Gộp, Tách, Xoay)
          </h2>
          <button onClick={onClose} className="btn-ghost">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-secondary)' }}>
          <button
            onClick={() => setActiveTab('merge')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: activeTab === 'merge' ? '3px solid #3b82f6' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'merge' ? '#3b82f6' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Combine size={16} /> Gộp PDF
          </button>

          <button
            onClick={() => setActiveTab('split')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: activeTab === 'split' ? '3px solid #3b82f6' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'split' ? '#3b82f6' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Split size={16} /> Tách PDF
          </button>

          <button
            onClick={() => setActiveTab('rotate')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: activeTab === 'rotate' ? '3px solid #3b82f6' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'rotate' ? '#3b82f6' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <RotateCw size={16} /> Xoay trang
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          {/* Tab 1: Merge PDFs */}
          {activeTab === 'merge' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Chọn từ 2 tệp PDF trở lên từ máy tính của bạn để gộp thành 1 tệp duy nhất.
              </p>

              <input
                ref={mergeInputRef}
                type="file"
                multiple
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) {
                    setMergeFiles(Array.from(e.target.files));
                  }
                }}
              />

              <button onClick={() => mergeInputRef.current?.click()} className="btn btn-secondary" style={{ width: '100%', padding: '16px 0' }}>
                <Upload size={18} /> Chọn các tệp PDF để gộp ({mergeFiles.length} tệp đã chọn)
              </button>

              {mergeFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mergeFiles.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        borderRadius: 6,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={16} color="#3b82f6" /> {file.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleMergePDFs}
                disabled={isProcessing || mergeFiles.length < 2}
                className="btn btn-primary"
                style={{ marginTop: 8 }}
              >
                <Combine size={18} /> Tiến hành gộp các PDF
              </button>
            </div>
          )}

          {/* Tab 2: Split PDF */}
          {activeTab === 'split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Tách các trang mong muốn từ một tệp PDF sẵn có.
              </p>

              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSplitFile(e.target.files[0]);
                  }
                }}
              />

              {splitFile && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Các trang cần trích xuất (ví dụ: 1, 3-5, 8):
                  </label>
                  <input
                    type="text"
                    value={splitPagesInput}
                    onChange={(e) => setSplitPagesInput(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)'
                    }}
                  />
                </div>
              )}

              <button
                onClick={handleSplitPDF}
                disabled={isProcessing || !splitFile}
                className="btn btn-primary"
                style={{ marginTop: 8 }}
              >
                <Split size={18} /> Tiến hành tách PDF
              </button>
            </div>
          )}

          {/* Tab 3: Rotate PDF */}
          {activeTab === 'rotate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Xoay các trang trong file PDF theo góc 90°, 180° hoặc 270°.
              </p>

              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setRotateFile(e.target.files[0]);
                  }
                }}
              />

              {rotateFile && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Trang cần xoay (ví dụ: 1, 2, 4):
                    </label>
                    <input
                      type="text"
                      value={rotatePagesInput}
                      onChange={(e) => setRotatePagesInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Góc xoay:
                    </label>
                    <select
                      value={rotateAngle}
                      onChange={(e) => setRotateAngle(parseInt(e.target.value, 10) as any)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <option value="90">90 độ (Theo chiều kim đồng hồ)</option>
                      <option value="180">180 độ (Đảo ngược)</option>
                      <option value="270">270 độ (Ngược chiều kim đồng hồ)</option>
                    </select>
                  </div>
                </>
              )}

              <button
                onClick={handleRotatePDF}
                disabled={isProcessing || !rotateFile}
                className="btn btn-primary"
                style={{ marginTop: 8 }}
              >
                <RotateCw size={18} /> Tiến hành xoay trang PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
