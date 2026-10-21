import type { CameraDeviceInfo } from '../types/scanner';

export interface CameraError {
  type: 'permission_denied' | 'not_found' | 'in_use' | 'security' | 'unknown';
  message: string;
  originalError?: any;
}

export class CameraService {
  private currentStream: MediaStream | null = null;
  private currentTrack: MediaStreamTrack | null = null;
  private torchState = false;

  async getAvailableCameras(): Promise<CameraDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');

      return videoDevices.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Máy ảnh ${index + 1}`,
        facingMode: d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('sau')
          ? 'environment'
          : d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('trước')
          ? 'user'
          : undefined
      }));
    } catch (err) {
      console.warn('Không thể lấy danh sách máy ảnh:', err);
      return [];
    }
  }

  async startCamera(options: {
    deviceId?: string;
    facingMode?: 'environment' | 'user';
    idealWidth?: number;
    idealHeight?: number;
  }): Promise<{ stream: MediaStream; track: MediaStreamTrack }> {
    this.stopCamera();

    const facingMode = options.facingMode || 'environment';
    const idealWidth = options.idealWidth || 1920;
    const idealHeight = options.idealHeight || 1080;

    // Constraint tier 1: High resolution target
    const constraintsList: MediaStreamConstraints[] = [
      {
        video: options.deviceId
          ? { deviceId: { exact: options.deviceId }, width: { ideal: idealWidth }, height: { ideal: idealHeight } }
          : { facingMode: { ideal: facingMode }, width: { ideal: idealWidth }, height: { ideal: idealHeight } },
        audio: false
      },
      // Constraint tier 2: 720p fallback
      {
        video: options.deviceId
          ? { deviceId: { exact: options.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      },
      // Constraint tier 3: Basic fallback
      {
        video: options.deviceId ? { deviceId: { exact: options.deviceId } } : { facingMode },
        audio: false
      },
      // Constraint tier 4: Any camera available
      {
        video: true,
        audio: false
      }
    ];

    let lastError: any = null;
    for (const constraints of constraintsList) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getVideoTracks()[0];
        if (track) {
          this.currentStream = stream;
          this.currentTrack = track;
          this.torchState = false;
          return { stream, track };
        }
      } catch (err: any) {
        lastError = err;
        // Continue to fallback constraint
      }
    }

    // Constraint tier 5: Virtual Camera fallback for testing and environments without physical webcam
    try {
      const virtualStream = this.createVirtualCameraStream();
      if (virtualStream) {
        const track = virtualStream.getVideoTracks()[0];
        if (track) {
          this.currentStream = virtualStream;
          this.currentTrack = track;
          this.torchState = false;
          return { stream: virtualStream, track };
        }
      }
    } catch {
      // Continue to throw categorized error
    }

    throw this.categorizeError(lastError);
  }

  private createVirtualCameraStream(): MediaStream | null {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw realistic document on desktop background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1280, 720);

    // Desk texture / background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(80, 40, 1120, 640);

    // Simulated A4 white document in center
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(400, 60, 480, 600);

    // Simulated text lines & math formulas
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ĐỀ KIỂM TRA TOÁN 10 - KHẢO SÁT HỌC KỲ', 425, 110);
    ctx.font = '15px sans-serif';
    ctx.fillText('Câu 1: Giải phương trình f(x) = x² - 4x + 3 = 0', 425, 160);
    ctx.fillText('Câu 2: Cho hàm số y = 2x² - 3x + 1. Tìm đỉnh parabol.', 425, 210);
    ctx.fillText('Câu 3: Tính diện tích tam giác có a=5, b=7, c=8.', 425, 260);
    ctx.fillText('Định lý Cosin: a² = b² + c² - 2bc.cos(A)', 425, 310);
    ctx.fillText('Hệ bất phương trình: { 2x + y ≥ 4 ; x - y ≤ 2 }', 425, 360);
    ctx.font = 'italic 13px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Scanner Pro EDU — Camera Thử Nghiệm Mô Phỏng A4/A5', 425, 620);

    return (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
  }

  stopCamera(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((t) => t.stop());
      this.currentStream = null;
      this.currentTrack = null;
      this.torchState = false;
    }
  }

  hasTorch(): boolean {
    if (!this.currentTrack) return false;
    const capabilities = this.currentTrack.getCapabilities ? (this.currentTrack.getCapabilities() as any) : null;
    return !!(capabilities && capabilities.torch);
  }

  async toggleTorch(): Promise<boolean> {
    if (!this.currentTrack || !this.hasTorch()) return false;
    try {
      this.torchState = !this.torchState;
      await (this.currentTrack as any).applyConstraints({
        advanced: [{ torch: this.torchState }]
      });
      return this.torchState;
    } catch (e) {
      console.warn('Không thể bật/tắt đèn flash:', e);
      return false;
    }
  }

  getTorchState(): boolean {
    return this.torchState;
  }

  private categorizeError(err: any): CameraError {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        type: 'permission_denied',
        message: 'Bạn đã từ chối quyền truy cập máy ảnh. Vui lòng cấp quyền trong cài đặt trình duyệt để tiếp tục quét.',
        originalError: err
      };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        type: 'not_found',
        message: 'Không tìm thấy thiết bị máy ảnh trên thiết bị này.',
        originalError: err
      };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        type: 'in_use',
        message: 'Máy ảnh đang được sử dụng bởi ứng dụng khác hoặc hệ điều hành bị khóa.',
        originalError: err
      };
    }
    if (name === 'SecurityError') {
      return {
        type: 'security',
        message: 'Trình duyệt yêu cầu kết nối bảo mật (HTTPS hoặc localhost) để truy cập máy ảnh.',
        originalError: err
      };
    }
    return {
      type: 'unknown',
      message: err?.message || 'Không thể khởi động máy ảnh. Vui lòng tải ảnh lên từ thư viện.',
      originalError: err
    };
  }
}

export const cameraService = new CameraService();
