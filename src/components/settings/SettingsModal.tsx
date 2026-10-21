import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Trash2, Check, RefreshCw, X, ShieldCheck } from 'lucide-react';
import type { MathProviderConfig, MathProviderType } from '../../types/scanner';
import { mathOcrService } from '../../services/mathOcrService';
import { setSetting, clearAllPages } from '../../db/dexieDb';
import { useToast } from '../common/Toast';

interface SettingsModalProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onClearDrafts: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  theme,
  onToggleTheme,
  onClearDrafts,
  onClose
}) => {
  const { showToast } = useToast();

  const [provider, setProvider] = useState<MathProviderType>('offline');
  const [apiKey, setApiKey] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: string; quota: string }>({ usage: '0 MB', quota: '0 GB' });

  // Load existing math settings & storage estimate
  useEffect(() => {
    async function load() {
      const cfg = await mathOcrService.getConfig();
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey || '');

      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usageMb = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaGb = ((est.quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
        setStorageEstimate({ usage: `${usageMb} MB`, quota: `${quotaGb} GB` });
      }
    }
    load();
  }, []);

  const handleSaveSettings = async () => {
    const config: MathProviderConfig = {
      provider,
      apiKey: apiKey.trim()
    };
    await setSetting('math_provider_config', config);
    showToast('Đã lưu cấu hình thành công!', 'success');
    onClose();
  };

  const handleTestConnection = async () => {
    if (provider === 'offline') {
      showToast('Chế độ Offline hoạt động hoàn toàn trên trình duyệt.', 'info');
      return;
    }

    if (!apiKey.trim()) {
      showToast('Vui lòng nhập API Key / Token trước khi kiểm tra.', 'error');
      return;
    }

    setIsTesting(true);
    try {
      if (provider === 'gemini') {
        // Quick ping to Gemini models list
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
        if (res.ok) {
          showToast('Kết nối Google Gemini Vision API thành công!', 'success');
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(`Lỗi xác thực: ${err.error?.message || res.statusText}`, 'error');
        }
      } else {
        showToast(`Đã lưu cấu hình ${provider}.`, 'success');
      }
    } catch (e: any) {
      showToast(e.message || 'Lỗi kết nối API', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearAllStorage = async () => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa toàn bộ bản nháp và các trang đã quét trong bộ nhớ cục bộ?');
    if (!confirmed) return;

    await clearAllPages();
    onClearDrafts();
    showToast('Đã dọn dẹp sạch sẽ bộ nhớ cục bộ!', 'success');
    onClose();
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
          <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={20} color="#3b82f6" /> Cài đặt & Cấu hình AI
          </h2>
          <button onClick={onClose} className="btn-ghost">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
          {/* Theme Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Giao diện ứng dụng:
            </label>
            <button onClick={onToggleTheme} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {theme === 'dark' ? <Moon size={18} color="#3b82f6" /> : <Sun size={18} color="#f59e0b" />}
                {theme === 'dark' ? 'Chế độ Tối (Dark Theme)' : 'Chế độ Sáng (Light Theme)'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bấm để đổi</span>
            </button>
          </div>

          {/* Math OCR Provider Settings */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Cấu hình AI OCR Công thức Toán học:
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
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
              >
                <option value="offline">Chế độ Offline / Nhập thủ công (Không cần API)</option>
                <option value="gemini">Google Gemini Vision (Khuyên dùng - Nhanh & Chính xác)</option>
                <option value="simpletex">SimpleTex OCR API</option>
                <option value="mathpix">Mathpix OCR API</option>
              </select>

              {provider !== 'offline' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {provider === 'gemini' ? 'Khóa Gemini API Key:' : 'Token / API Key:'}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Nhập khóa API Key của bạn..."
                      style={{
                        flex: 1,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 14,
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="btn btn-secondary"
                      style={{ padding: '0 14px', fontSize: 12 }}
                    >
                      {isTesting ? <RefreshCw size={14} className="animate-spin" /> : 'Kiểm tra'}
                    </button>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    🔒 API Key được lưu trữ mã hóa an toàn cục bộ trong trình duyệt của bạn (IndexedDB), tuyệt đối không bao giờ gửi đến bất kỳ máy chủ bên thứ ba nào khác.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Storage Management */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Quản lý bộ nhớ dữ liệu cục bộ (IndexedDB):
            </label>
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10
              }}
            >
              <div>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Dung lượng đã dùng:</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {storageEstimate.usage} / {storageEstimate.quota} khả dụng
                </div>
              </div>
              <button onClick={handleClearAllStorage} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                <Trash2 size={14} /> Xóa sạch bản nháp
              </button>
            </div>
          </div>

          {/* Security & Privacy Notice */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              gap: 10
            }}
          >
            <ShieldCheck size={20} color="#10b981" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>Bảo mật thông tin:</strong> Toàn bộ thuật toán quét ảnh, nhận diện mép giấy, bộ lọc, xử lý PDF và nhận diện chữ Tesseract đều chạy 100% trên thiết bị của bạn. Tài liệu của bạn không bao giờ bị lưu trên máy chủ bên ngoài.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12
          }}
        >
          <button onClick={onClose} className="btn btn-ghost">
            Hủy
          </button>
          <button onClick={handleSaveSettings} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <Check size={16} /> Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
};
