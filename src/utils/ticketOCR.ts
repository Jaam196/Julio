/**
 * Specialized Restaurant Ticket OCR Pipeline and Temporal Candidate Tracker
 */

import { isValidTicketNumber } from './ticketUtils';
import {
  scoreOcrCandidates,
  CandidateEvaluation,
  RawOcrToken,
  MIN_ACCEPTANCE_SCORE
} from './ticketCandidateScorer';
import { createMultiPassVariants, preprocessImage } from './imagePreprocessing';

export { isValidTicketNumber };

export interface TicketOcrResult {
  detectedTicketNumber: string | null; // e.g. "657" or null
  confidence: number; // 0 to 100
  topCandidate: CandidateEvaluation | null;
  allCandidates: CandidateEvaluation[];
  status: 'detected' | 'no_detected' | 'searching';
  message: string;
  rawText: string;
  passName?: string;
}

export interface CandidateTrackerOptions {
  requiredStableFrames: number; // Default 2 frames
  memoryWindowMs: number; // Default 2500ms
}

/**
 * Temporal Candidate Memory Buffer
 * Prevents camera jitter and flickering (e.g., jumping between 657 and 579).
 * Requires N consistent frame detections before accepting a ticket number.
 */
export class CandidateTemporalTracker {
  private memory: Map<
    string,
    { count: number; totalScore: number; lastSeen: number; bestCandidate: CandidateEvaluation }
  > = new Map();

  private requiredFrames: number;
  private memoryWindowMs: number;

  constructor(options: Partial<CandidateTrackerOptions> = {}) {
    this.requiredFrames = options.requiredStableFrames ?? 2;
    this.memoryWindowMs = options.memoryWindowMs ?? 2500;
  }

  public setRequiredFrames(frames: number): void {
    this.requiredFrames = Math.max(1, frames);
  }

  /**
   * Registers a newly evaluated candidate from a frame.
   * Returns locked candidate if stable threshold reached, or null if still stabilizing.
   */
  public registerCandidate(candidateEval: CandidateEvaluation | null): {
    lockedCandidate: CandidateEvaluation | null;
    stableCount: number;
    requiredCount: number;
  } {
    const now = Date.now();

    // Clean up expired entries in memory
    for (const [num, entry] of this.memory.entries()) {
      if (now - entry.lastSeen > this.memoryWindowMs) {
        this.memory.delete(num);
      }
    }

    if (!candidateEval || !candidateEval.accepted) {
      return { lockedCandidate: null, stableCount: 0, requiredCount: this.requiredFrames };
    }

    const num = candidateEval.candidate;
    const existing = this.memory.get(num);

    if (!existing) {
      this.memory.set(num, {
        count: 1,
        totalScore: candidateEval.finalScore,
        lastSeen: now,
        bestCandidate: candidateEval
      });

      if (this.requiredFrames === 1) {
        return { lockedCandidate: candidateEval, stableCount: 1, requiredCount: 1 };
      }
      return { lockedCandidate: null, stableCount: 1, requiredCount: this.requiredFrames };
    }

    const newCount = existing.count + 1;
    const newTotalScore = existing.totalScore + candidateEval.finalScore;
    const bestCand = candidateEval.finalScore > existing.bestCandidate.finalScore ? candidateEval : existing.bestCandidate;

    this.memory.set(num, {
      count: newCount,
      totalScore: newTotalScore,
      lastSeen: now,
      bestCandidate: bestCand
    });

    if (newCount >= this.requiredFrames) {
      return { lockedCandidate: bestCand, stableCount: newCount, requiredCount: this.requiredFrames };
    }

    return { lockedCandidate: null, stableCount: newCount, requiredCount: this.requiredFrames };
  }

  public reset(): void {
    this.memory.clear();
  }
}

/**
 * Runs OCR on an image canvas using Tesseract worker and evaluates candidate ticket numbers.
 * Supports multi-pass automatic fallback if pass 1 fails.
 */
export async function processTicketOCR(
  worker: any,
  cropCanvas: HTMLCanvasElement,
  options: {
    contrast?: number;
    brightness?: number;
    binarizeThreshold?: number;
    sharpenEnabled?: boolean;
    noiseRemoval?: boolean;
    minConfidence?: number;
    enableSecondPass?: boolean;
  } = {}
): Promise<TicketOcrResult> {
  const minScoreThreshold = options.minConfidence ? options.minConfidence / 100 : MIN_ACCEPTANCE_SCORE;

  // Pass 1: Primary preprocessed image
  const primaryCanvas = document.createElement('canvas');
  preprocessImage(cropCanvas, primaryCanvas, {
    contrast: options.contrast ?? 75,
    brightness: options.brightness ?? 10,
    binarizeThreshold: options.binarizeThreshold ?? 128,
    sharpen: options.sharpenEnabled ?? true,
    noiseRemoval: options.noiseRemoval ?? false
  });

  const resPass1 = await executeOcrPass(worker, primaryCanvas, minScoreThreshold);

  if (resPass1.status === 'detected' && resPass1.topCandidate) {
    return { ...resPass1, passName: 'Pass 1 (Estándar)' };
  }

  // Pass 2: Secondary Pass with adaptive thresholding & contrast boost (if enabled)
  if (options.enableSecondPass !== false) {
    const variants = createMultiPassVariants(cropCanvas);
    
    // Try Adaptive Variant (Pass 2)
    const adaptiveVariant = variants.find((v) => v.name === 'pass2_adaptive');
    if (adaptiveVariant) {
      const resPass2 = await executeOcrPass(worker, adaptiveVariant.canvas, minScoreThreshold);
      if (resPass2.status === 'detected' && resPass2.topCandidate) {
        return { ...resPass2, passName: 'Pass 2 (Adaptativo)' };
      }
    }

    // Try Grayscale Variant (Pass 3)
    const grayVariant = variants.find((v) => v.name === 'pass3_grayscale');
    if (grayVariant) {
      const resPass3 = await executeOcrPass(worker, grayVariant.canvas, minScoreThreshold);
      if (resPass3.status === 'detected' && resPass3.topCandidate) {
        return { ...resPass3, passName: 'Pass 3 (Escala de Grises)' };
      }
    }
  }

  // If all passes failed to yield a valid accepted candidate:
  return {
    detectedTicketNumber: null,
    confidence: 0,
    topCandidate: resPass1.allCandidates[0] || null,
    allCandidates: resPass1.allCandidates,
    status: 'no_detected',
    message: 'No se pudo detectar un número de ticket válido',
    rawText: resPass1.rawText,
    passName: 'Multi-pass agotado'
  };
}

async function executeOcrPass(
  worker: any,
  canvas: HTMLCanvasElement,
  minScoreThreshold: number
): Promise<TicketOcrResult> {
  const result = await worker.recognize(canvas);
  const rawText = result.data?.text || '';

  const rawWords: any[] = result.data?.words || [];
  const tokens: RawOcrToken[] = rawWords.map((w: any) => ({
    text: w.text || '',
    confidence: w.confidence || 0,
    bbox: w.bbox ? { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } : undefined,
    lineText: w.line?.text || ''
  }));

  const allCandidates = scoreOcrCandidates(rawText, tokens, canvas.height, minScoreThreshold);
  const acceptedCandidate = allCandidates.find((c) => c.accepted);

  if (acceptedCandidate && isValidTicketNumber(acceptedCandidate.candidate)) {
    return {
      detectedTicketNumber: acceptedCandidate.candidate,
      confidence: Math.round(acceptedCandidate.finalScore * 100),
      topCandidate: acceptedCandidate,
      allCandidates,
      status: 'detected',
      message: `Ticket detectado: ${acceptedCandidate.candidate} (Confianza: ${Math.round(acceptedCandidate.finalScore * 100)}%)`,
      rawText
    };
  }

  return {
    detectedTicketNumber: null,
    confidence: 0,
    topCandidate: allCandidates[0] || null,
    allCandidates,
    status: 'no_detected',
    message: 'No se pudo detectar un número de ticket válido',
    rawText
  };
}
