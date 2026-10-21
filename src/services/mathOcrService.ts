import type { MathProviderConfig } from '../types/scanner';
import { getSetting } from '../db/dexieDb';

export const DEFAULT_MATH_CONFIG: MathProviderConfig = {
  provider: 'offline',
  apiKey: ''
};

export class MathOCRService {
  /**
   * Retrieves active math provider configuration.
   */
  async getConfig(): Promise<MathProviderConfig> {
    return await getSetting<MathProviderConfig>('math_provider_config', DEFAULT_MATH_CONFIG);
  }

  /**
   * Executes Math OCR on a cropped formula image.
   * Uses selected provider adapter or reports unconfigured state honestly.
   */
  async recognizeFormula(
    cropDataUrl: string,
    config: MathProviderConfig
  ): Promise<{ latex: string; confidence: number; note?: string }> {
    if (config.provider === 'offline' || !config.apiKey.trim()) {
      // Offline / Unconfigured mode:
      // Return unconfigured status with clean starter template and honest notification
      return {
        latex: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        confidence: 0,
        note: 'Chế độ Offline / Chưa cấu hình API Key. Bạn có thể tự soạn thảo công thức hoặc cấu hình API trong Cài đặt.'
      };
    }

    if (config.provider === 'gemini') {
      return await this.callGeminiVision(cropDataUrl, config.apiKey);
    }

    if (config.provider === 'simpletex') {
      return await this.callSimpleTex(cropDataUrl, config.apiKey);
    }

    if (config.provider === 'mathpix') {
      return await this.callMathpix(cropDataUrl, config.apiKey, config.endpoint);
    }

    throw new Error(`Nhà cung cấp Math OCR "${config.provider}" chưa được hỗ trợ.`);
  }

  /**
   * Adapter for Google Gemini Vision API to extract LaTeX from math formula image
   */
  private async callGeminiVision(
    cropDataUrl: string,
    apiKey: string
  ): Promise<{ latex: string; confidence: number; note?: string }> {
    const base64Data = cropDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are an expert Math OCR system. Analyze the provided image of a math equation/expression and output ONLY valid LaTeX math code.
Do not wrap in markdown quotes or dollar signs, just the raw LaTeX expression.
Examples:
- Fraction: \\frac{a}{b}
- Square root: \\sqrt{x^2 + y^2}
- Integral: \\int_{0}^{\\pi} \\sin(x) \\, dx
- System of equations: \\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}
- Matrix: \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}
Return only the LaTeX code.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || response.statusText;
      throw new Error(`Lỗi Gemini API: ${msg}`);
    }

    const data = await response.json();
    let rawLatex = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean up markdown markers if any
    rawLatex = rawLatex.replace(/```latex/gi, '').replace(/```/g, '').replace(/^\$+|\$+$/g, '').trim();

    return {
      latex: rawLatex,
      confidence: 0.95,
      note: 'Nhận diện bởi Gemini Vision. Vui lòng kiểm tra lại trước khi chèn.'
    };
  }

  /**
   * Adapter for SimpleTex API
   */
  private async callSimpleTex(
    cropDataUrl: string,
    apiKey: string
  ): Promise<{ latex: string; confidence: number; note?: string }> {
    const blob = await (await fetch(cropDataUrl)).blob();
    const formData = new FormData();
    formData.append('file', blob, 'formula.jpg');

    const response = await fetch('https://server.simpletex.cn/api/latex_ocr', {
      method: 'POST',
      headers: {
        token: apiKey
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Lỗi SimpleTex API: ${response.statusText}`);
    }

    const res = await response.json();
    if (res.status && res.data && res.data.latex) {
      return {
        latex: res.data.latex,
        confidence: res.data.confidence || 0.9,
        note: 'Nhận diện bởi SimpleTex OCR.'
      };
    }

    throw new Error(res.message || 'Không thể nhận diện công thức từ SimpleTex.');
  }

  /**
   * Adapter for Mathpix API
   */
  private async callMathpix(
    cropDataUrl: string,
    appKey: string,
    appId?: string
  ): Promise<{ latex: string; confidence: number; note?: string }> {
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        app_id: appId || 'scanner_pro_edu',
        app_key: appKey
      },
      body: JSON.stringify({
        src: cropDataUrl,
        formats: ['latex_styled']
      })
    });

    if (!response.ok) {
      throw new Error(`Lỗi Mathpix API: ${response.statusText}`);
    }

    const res = await response.json();
    return {
      latex: res.latex_styled || res.text || '',
      confidence: res.confidence || 0.9,
      note: 'Nhận diện bởi Mathpix.'
    };
  }
}

export const mathOcrService = new MathOCRService();
