import React, { useState, useEffect } from 'react';
import { Type, Copy, Download, X, Check, RefreshCw } from 'lucide-react';
import type { PageRecord, OCRData } from '../../types/scanner';
import { ocrService } from '../../services/ocrService';
import { useToast } from '../common/Toast';

interface TextOCRModalProps {
  page: PageRecord;
  onSaveOCR: (pageId: string, ocrData: OCRData) => void;
  onClose: () => void;
}

export const TextOCRModal: React.FC<TextOCRModalProps> = ({ page, onSaveOCR, onClose }) => {
  const { showToast } = useToast();

  const [language, setLanguage] = useState<'vie+eng' | 'vie' | 'eng'>('vie+eng');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [recognizedText, setRecognizedText] = useState(page.ocrData?.text || '');
  const [confidence, setConfidence] = useState(page.ocrData?.confidence || 0);

  // Auto-run if page doesn't have OCR yet
  useEffect(() => {
    if (!page.ocrData) {
      handleRunOCR();
    }
  }, []);

  const handleRunOCR = async () => {
    setIsProcessing(true);
    setProgressPct(5);
    setProgressMsg('Đang khởi động AI nhận diện chữ...');

    try {
      const result = await ocrService.recognizeImage(page.processedImage, language, (pct, msg) => {
        setProgressPct(pct);
        setProgressMsg(msg);
      });

      setRecognizedText(result.text);
      setConfidence(result.confidence);
      onSaveOCR(page.id, result);
      showToast('Đã nhận diện văn bản thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nhận diện chữ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!recognizedText.trim()) return;
    navigator.clipboard.writeText(recognizedText);
    showToast('Đã sao chép toàn bộ văn bản!', 'success');
  };

  const handleDownloadTxt = () => {
    if (!recognizedText.trim()) return;
    const blob = new Blob([recognizedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VanBan_Trang_${page.pageNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống tệp .txt', 'success');
  };

  const handleSaveTextChanges = () => {
    const updatedData: OCRData = {
      text: recognizedText,
      confidence,
      lines: page.ocrData?.lines || [],
      language,
      processedAt: Date.now()
    };
    onSaveOCR(page.id, updatedData);
    showToast('Đã lưu văn bản chỉnh sửa vào trang!', 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 840, height: '88vh' }} onClick={(e) => e.stopPropagation()}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Type size={20} color="#3b82f6" />
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                Trích xuất văn bản (OCR) — Trang {page.pageNumber}
              </h2>
              {confidence > 0 && (
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                  Độ chính xác AI ước tính: {Math.round(confidence)}%
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={language}
              disabled={isProcessing}
              onChange={(e) => setLanguage(e.target.value as any)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12
              }}
            >
              <option value="vie+eng">Tiếng Việt & Tiếng Anh</option>
              <option value="vie">Chỉ Tiếng Việt</option>
              <option value="eng">Chỉ Tiếng Anh</option>
            </select>

            <button onClick={handleRunOCR} disabled={isProcessing} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
              <RefreshCw size={14} /> Quét lại
            </button>

            <button onClick={onClose} className="btn-ghost">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Progress Bar when working */}
        {isProcessing && (
          <div style={{ padding: '10px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <span>{progressMsg}</span>
              <span style={{ fontWeight: 700 }}>{progressPct}%</span>
            </div>
            <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: '#3b82f6', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {/* Body Side-by-Side: Page Image on Left, Editable Text on Right */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Scanned Page Image */}
          <div
            style={{
              flex: 1,
              background: '#090d16',
              borderRight: '1px solid var(--border-default)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img
              src={page.processedImage}
              alt="Ảnh tài liệu đối chiếu"
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
            />
          </div>

          {/* Right Column: Editable OCR Text Area */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', padding: 16, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Văn bản đã nhận diện (có thể chỉnh sửa trực tiếp):
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {recognizedText.length} ký tự
              </span>
            </div>

            <textarea
              value={recognizedText}
              onChange={(e) => setRecognizedText(e.target.value)}
              placeholder="Kết quả nhận diện chữ sẽ hiển thị ở đây..."
              style={{
                flex: 1,
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: 14,
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none'
              }}
            />

            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              ⚠️ Lưu ý: Với tài liệu in mờ, chữ viết tay hoặc công thức toán, bạn nên đối chiếu ảnh bên trái và rà soát lại văn bản.
            </p>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopy} disabled={!recognizedText.trim()} className="btn btn-secondary">
              <Copy size={16} /> Sao chép văn bản
            </button>
            <button onClick={handleDownloadTxt} disabled={!recognizedText.trim()} className="btn btn-secondary">
              <Download size={16} /> Tải tệp .txt
            </button>
          </div>

          <button onClick={handleSaveTextChanges} className="btn btn-primary">
            <Check size={16} /> Lưu vào trang & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
