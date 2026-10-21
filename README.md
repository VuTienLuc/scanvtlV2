# Scanner Pro EDU — Máy Quét Giáo Án, Tài Liệu & Toán Học

Ứng dụng Web / PWA chuyên dụng quét và số hóa tài liệu giáo dục, giáo án, sách bài tập và đề thi Toán học với tốc độ cao, hoạt động 100% offline-first bảo mật trên máy khách.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6.svg)
![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)

---

## 🌟 Tính Năng Nổi Bật

1. **Quét Liên Tục — Xuất PDF Siêu Tốc (Fast Burst Scan)**
   - Cơ chế chụp liên tục không dừng máy ảnh, tự động lưu từng trang vào IndexedDB ngầm.
   - Hẹn giờ tự động chụp (Auto-timer 2s/3s) giúp rảnh cả 2 tay để lật sách.
   - Thuật toán `generateFastPDF` nhúng trực tiếp byte nhị phân (`Uint8Array`) vào `pdf-lib`, xuất file PDF nhiều trang trong **< 1 giây**.
   - Hỗ trợ tải hàng loạt (batch import) cùng lúc hàng chục ảnh từ thư viện.

2. **Chế Độ Quét Sách 2 Trang (Dual-Page Book Splitter)**
   - Tự động nhận diện và chia đôi trang sách (Trang Trái / Trang Phải).
   - Thanh trượt gáy sách tương tác (30% - 70%) điều chỉnh đường chia linh hoạt.

3. **Chỉnh Sửa & Thị Giác Máy Tính (Computer Vision)**
   - Tự động phát hiện 4 góc tài liệu bằng OpenCV Canny Edge / Contours (kèm fallback thuần TS).
   - Biến đổi phối cảnh (Perspective Warping) chuẩn ma trận 3x3 Homography.
   - Bộ lọc xử lý ảnh tài liệu: Màu gốc, Tăng cường (Magic Color), Bradley-Roth Adaptive Threshold (Đen trắng chuẩn tài liệu), Tương phản cao.
   - Công cụ chấm bài, ghi chú bút vẽ tự do với Undo / Redo.

4. **Studio OCR Toán Học & Chuyển Đổi LaTeX**
   - Hộp cắt công thức chuyên dụng (Cropper) cho từng công thức toán.
   - Kết nối AI Vision (Gemini 2.5 Flash, SimpleTex, Mathpix) trích xuất mã LaTeX chuẩn xác.
   - Bảng ký hiệu toán học nhanh và trình xem trước công thức tức thời bằng KaTeX.

5. **Xuất Bản Đa Định Dạng**
   - **PDF**: Nén ảnh thật (Real JPEG compression 30% - 100%), PDF có lớp chữ tìm kiếm (Searchable PDF with invisible text layer).
   - **Công cụ PDF**: Ghép nhiều PDF, Tách trang PDF, Xoay trang PDF.
   - **Microsoft Word (.docx)**: Chế độ Giữ nguyên bố cục ảnh và Chế độ Chữ biên tập kèm công thức Word Math OMML.

6. **Offline-First & Bảo Mật Tuyệt Đối**
   - Lưu trữ dữ liệu an toàn cục bộ trên trình duyệt qua Dexie (IndexedDB).
   - Tự động khôi phục bản nháp khi vô tình đóng trình duyệt hoặc tải lại trang.
   - Chuẩn PWA: Cài đặt trực tiếp lên màn hình chính máy tính hoặc điện thoại di động (iOS/Android).

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: React 19, TypeScript, Vite.
- **Styling**: Vanilla CSS (Tailored Design System, HSL color tokens, Glassmorphism, Dark/Light mode).
- **Computer Vision**: OpenCV.js (WebAssembly) + TS Canvas Homography Engine.
- **Xử lý PDF**: `pdf-lib`.
- **Nhận diện văn bản**: `tesseract.js` (Hỗ trợ Tiếng Việt `vie` và Tiếng Anh `eng`).
- **Toán học**: `katex` & Math OCR Adapters.
- **Xử lý Word**: `docx`.
- **Cơ sở dữ liệu**: `dexie` (IndexedDB).
- **Kiểm thử**: Vitest (16/16 Unit Tests pass).

---

## 🚀 Cài Đặt & Chạy Cục Bộ

```bash
# Cài đặt thư viện
npm install

# Khởi chạy máy chủ phát triển
npm run dev

# Kiểm thử Unit Test
npm test

# Build bản chạy sản xuất
npm run build

# Xem thử bản build
npm run preview
```

---

## 📄 Bản Quyền

Phát triển bởi **Vũ Tiến Lực**. Dự án mã nguồn mở theo giấy phép MIT.
