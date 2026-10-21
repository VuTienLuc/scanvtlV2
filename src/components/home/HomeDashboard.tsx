import React, { useRef } from 'react';
import {
  Camera,
  BookOpen,
  Upload,
  FileText,
  Sigma,
  Wrench,
  Settings,
  Sun,
  Moon,
  Download,
  Sparkles,
  Layers,
  ChevronRight,
  Zap
} from 'lucide-react';
import type { PageRecord } from '../../types/scanner';

interface HomeDashboardProps {
  committedPages: PageRecord[];
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onStartSingleScan: () => void;
  onStartContinuousScan: () => void;
  onStartBookScan: () => void;
  onOpenPageManager: () => void;
  onOpenExportPDF: () => void;
  onOpenPDFTools: () => void;
  onOpenSettings: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  committedPages,
  theme,
  onToggleTheme,
  onStartSingleScan,
  onStartContinuousScan,
  onStartBookScan,
  onOpenPageManager,
  onOpenExportPDF,
  onOpenPDFTools,
  onOpenSettings,
  onImportFile
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <nav
        style={{
          height: 64,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)'
            }}
          >
            <Camera size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Scanner Pro <span style={{ color: '#3b82f6' }}>EDU</span>
            </h1>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Máy Quét Giáo Án & Toán Học</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onToggleTheme}
            className="btn-ghost"
            style={{ padding: 8, borderRadius: '50%', cursor: 'pointer' }}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            {theme === 'dark' ? <Sun size={20} color="#f59e0b" /> : <Moon size={20} color="#3b82f6" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="btn-ghost"
            style={{ padding: 8, borderRadius: '50%', cursor: 'pointer' }}
            title="Cài đặt & Cấu hình AI"
          >
            <Settings size={20} />
          </button>
        </div>
      </nav>

      {/* Hero Header */}
      <header
        style={{
          padding: '40px 24px 24px',
          maxWidth: 1000,
          margin: '0 auto',
          width: '100%',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#3b82f6',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16
          }}
        >
          <Sparkles size={14} /> Phiên bản PWA Chuyên Nghiệp — Xử Lý Cục Bộ 100%
        </div>

        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 12 }}>
          Số Hóa Tài Liệu, Giáo Án & Công Thức Toán Học
        </h2>

        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto 28px', lineHeight: 1.6 }}>
          Phát hiện 4 góc giấy tự động, nắn thẳng phối cảnh, làm sạch nền sách, tạo tệp Searchable PDF tìm kiếm được và xuất Word hỗ trợ công thức Toán học chuẩn xác.
        </p>

        {/* Existing Draft Document Banner */}
        {committedPages.length > 0 && (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid #3b82f6',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              maxWidth: 620,
              margin: '0 auto 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-glow)',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#000',
                  flexShrink: 0
                }}
              >
                <img
                  src={committedPages[committedPages.length - 1].thumbnail}
                  alt="Trang nháp"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div>
                <strong style={{ fontSize: 15, color: 'var(--text-primary)', display: 'block' }}>
                  Tài liệu đang xử lý: {committedPages.length} trang
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Bản nháp được lưu an toàn trong IndexedDB của máy bạn.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onOpenExportPDF} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>
                <Download size={15} /> Xuất PDF
              </button>
              <button onClick={onOpenPageManager} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                Xem trang <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Primary Call-to-Action Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            maxWidth: 820,
            margin: '0 auto'
          }}
        >
          {/* Continuous Fast Scan Hero Button */}
          <button
            onClick={onStartContinuousScan}
            className="btn"
            style={{
              padding: '22px 18px',
              flexDirection: 'column',
              gap: 10,
              background: 'linear-gradient(135deg, #b45309, #f59e0b)',
              color: '#fff',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              boxShadow: '0 8px 25px rgba(245, 158, 11, 0.4)',
              cursor: 'pointer',
              gridColumn: '1 / -1'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={28} color="#fff" />
              <span style={{ fontSize: 18, fontWeight: 800 }}>Quét Ảnh Liên Tục — Tạo PDF Siêu Tốc</span>
            </div>
            <span style={{ fontSize: 13, opacity: 0.95, fontWeight: 500 }}>
              ⚡ Chụp liên tiếp không dừng, tự động lưu từng trang & xuất PDF tức thì trong 1 chạm
            </span>
          </button>

          <button
            onClick={onStartSingleScan}
            className="btn"
            style={{
              padding: '18px 16px',
              flexDirection: 'column',
              gap: 8,
              background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
              color: '#fff',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.35)',
              cursor: 'pointer'
            }}
          >
            <Camera size={28} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Quét 1 Trang</span>
            <span style={{ fontSize: 11, opacity: 0.85 }}>Tự tìm góc & nắn thẳng</span>
          </button>

          <button
            onClick={onStartBookScan}
            className="btn"
            style={{
              padding: '18px 16px',
              flexDirection: 'column',
              gap: 8,
              background: 'linear-gradient(135deg, #065f46, #10b981)',
              color: '#fff',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
              cursor: 'pointer'
            }}
          >
            <BookOpen size={28} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Quét Sách 2 Trang</span>
            <span style={{ fontSize: 11, opacity: 0.85 }}>Tự chia đôi Trái & Phải</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{
              padding: '18px 16px',
              flexDirection: 'column',
              gap: 8,
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer'
            }}
          >
            <Upload size={28} color="#94a3b8" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Tải ảnh hàng loạt</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chọn nhiều ảnh cùng lúc</span>
          </button>

          <button
            onClick={onOpenPDFTools}
            className="btn btn-secondary"
            style={{
              padding: '18px 16px',
              flexDirection: 'column',
              gap: 8,
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer'
            }}
          >
            <Wrench size={28} color="#94a3b8" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Công cụ PDF</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gộp, tách, xoay file</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onImportFile}
        />
      </header>

      {/* Feature Highlights Grid */}
      <section
        style={{
          maxWidth: 1000,
          margin: '30px auto',
          padding: '0 24px',
          width: '100%'
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Tính Năng Chuyên Nghiệp Cho Giáo Dục
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              padding: 20,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ color: '#3b82f6', marginBottom: 10 }}>
              <Layers size={26} />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Thị Giác Máy Tính OpenCV
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Tìm mép giấy thông minh, chỉnh 4 điểm phối cảnh trực tiếp và bộ lọc làm sạch nền trang sách bằng Adaptive Thresholding.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              padding: 20,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ color: '#10b981', marginBottom: 10 }}>
              <FileText size={26} />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Searchable PDF Nén Thật
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Tùy chỉnh nén ảnh thực tế (30%, 60%, 85%) và nhúng lớp văn bản OCR ẩn chuẩn tọa độ, cho phép bôi đen sao chép và tìm kiếm từ (Ctrl+F).
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              padding: 20,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div style={{ color: '#8b5cf6', marginBottom: 10 }}>
              <Sigma size={26} />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              OCR Công Thức Toán Học
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Khoanh vùng nhận diện công thức Toán, đối chiếu với bộ kết xuất KaTeX tức thì và xuất Word với định dạng công thức Office Math chuẩn.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          padding: '24px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-muted)'
        }}
      >
        <p>Scanner Pro EDU — Dành riêng cho giáo viên, học sinh và chuyên gia số hóa tài liệu.</p>
        <p style={{ marginTop: 4 }}>Bảo mật 100% dữ liệu cục bộ trên thiết bị của bạn.</p>
      </footer>
    </div>
  );
};
