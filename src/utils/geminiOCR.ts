import { isValidTicketNumber } from './ticketUtils';

export interface GeminiOcrResult {
  ticketNumber: string | null;
  confidence: number;
}

/**
 * Recognizes a ticket number (1-6 digits, e.g. 154, 1548) from a base64 image using Gemini Flash.
 * Returns { ticketNumber: string | null, confidence: number }.
 * Never throws — gracefully catches network/server errors and returns null for seamless fallback.
 */
export async function recognizeTicketWithGemini(imageBase64: string): Promise<GeminiOcrResult> {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { ticketNumber: null, confidence: 0 };
  }

  try {
    const response = await fetch('/api/ocr/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      return { ticketNumber: null, confidence: 0 };
    }

    const data = await response.json();
    const rawNumber = data?.ticketNumber;
    const confidence = typeof data?.confidence === 'number' ? data.confidence : 0;

    if (rawNumber && /^\d{1,6}$/.test(String(rawNumber).trim())) {
      const cleanNum = String(rawNumber).trim();
      return {
        ticketNumber: cleanNum,
        confidence: Math.max(1, Math.min(100, confidence || 95)),
      };
    }

    return { ticketNumber: null, confidence: 0 };
  } catch (err) {
    // Network offline, server timeout, or parse error — fallback silently
    console.warn('[Gemini OCR] Request failed or offline:', err);
    return { ticketNumber: null, confidence: 0 };
  }
}
