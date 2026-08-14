/**
 * Candidate Scorer for Restaurant Ticket Numbers
 * 
 * Specifically designed to identify 3-digit ticket numbers (e.g. "657", "329", "579", "179")
 * from thermal/inkjet receipts while strictly rejecting long codes (T001006/5057), dates,
 * times, prices, and secondary text.
 */

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RawOcrToken {
  text: string;
  confidence: number; // 0 to 100
  bbox?: BoundingBox;
  lineText?: string;
  lineIndex?: number;
}

export interface CandidateEvaluation {
  candidate: string; // Must be strictly 3 digits, e.g. "657"
  confidenceScore: number; // 0.0 to 1.0
  sizeScore: number; // 0.0 to 1.0
  positionScore: number; // 0.0 to 1.0
  contextScore: number; // 0.0 to 1.0
  isolationScore: number; // 0.0 to 1.0
  finalScore: number; // 0.0 to 1.0
  accepted: boolean;
  rejectReason?: string;
  bbox?: BoundingBox;
  sourceToken?: string;
  lineText?: string;
}

export const MIN_ACCEPTANCE_SCORE = 0.50; // 50% threshold for valid tickets

/**
 * Checks if a string is strictly 3 digits (000-999).
 */
export function isExactThreeDigits(str: string): boolean {
  return /^\d{3}$/.test(str.trim());
}

/**
 * Common OCR character confusion normalization for thermal printers
 * (e.g. 'S' -> '5', 'I'/'l'/'|' -> '1', 'O'/'o' -> '0', 'B' -> '8', 'Z'/'z' -> '2')
 */
export function normalizeOcrDigits(str: string): string {
  return str
    .replace(/[S]/g, '5')
    .replace(/[I|l!]/g, '1')
    .replace(/[O]/g, '0')
    .replace(/[B]/g, '8')
    .replace(/[Z]/g, '2');
}

/**
 * Evaluates full OCR text and word/line tokens, extracting and scoring 3-digit ticket candidates.
 */
export function scoreOcrCandidates(
  rawText: string,
  tokens: RawOcrToken[] = [],
  imageHeight: number = 500,
  minScoreThreshold: number = MIN_ACCEPTANCE_SCORE
): CandidateEvaluation[] {
  const evaluations: CandidateEvaluation[] = [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  // Calculate median bounding box height for normal text in document (if tokens with bbox are provided)
  const bboxHeights = tokens
    .filter((t) => t.bbox && t.bbox.y1 > t.bbox.y0)
    .map((t) => t.bbox!.y1 - t.bbox!.y0);
  
  bboxHeights.sort((a, b) => a - b);
  const medianFontHeight = bboxHeights.length > 0
    ? bboxHeights[Math.floor(bboxHeights.length / 2)]
    : 18;

  // 1. Process explicit tokens first
  tokens.forEach((token) => {
    const rawWord = token.text.trim();
    if (!rawWord) return;

    const lineText = token.lineText || getLineForToken(rawWord, lines);
    processTokenCandidates(rawWord, token.confidence, token.bbox, lineText, token.lineIndex, medianFontHeight, imageHeight, minScoreThreshold, evaluations);
  });

  // 2. Line-by-line parsing: handles words, spaced digits (e.g. "6 5 7"), and prefixed tickets
  lines.forEach((line, lineIdx) => {
    // A. Check individual words in line
    const words = line.split(/\s+/);
    words.forEach((word) => {
      const alreadyEvaluated = evaluations.some((e) => e.sourceToken === word && e.lineText === line);
      if (!alreadyEvaluated) {
        processTokenCandidates(word, 85, undefined, line, lineIdx, medianFontHeight, imageHeight, minScoreThreshold, evaluations);
      }
    });

    // B. Check for spaced 3 digits on line (e.g., "6  5  7" or "3 2 9" or "  1 7 9  ")
    const spacedMatch = line.match(/(?:^|[^\d])(\d)\s+(\d)\s+(\d)(?:[^\d]|$)/);
    if (spacedMatch) {
      const mergedDigits = `${spacedMatch[1]}${spacedMatch[2]}${spacedMatch[3]}`;
      const alreadyFound = evaluations.some((e) => e.candidate === mergedDigits && e.lineText === line);
      if (!alreadyFound && !isDateOrTimeOrPriceLine(line)) {
        processTokenCandidates(mergedDigits, 88, undefined, line, lineIdx, medianFontHeight, imageHeight, minScoreThreshold, evaluations);
      }
    }

    // C. Check for explicit ticket prefix on line (e.g., "TICKET: 657" or "Nº 329" or "ORDEN # 579")
    const prefixMatch = line.match(/(?:TICKET|PEDIDO|ORDEN|TURNO|N[º°#]|NO\.)\s*[:#-]?\s*(\d{3})\b/i);
    if (prefixMatch) {
      const candidateNum = prefixMatch[1];
      const alreadyFound = evaluations.some((e) => e.candidate === candidateNum && e.lineText === line);
      if (!alreadyFound) {
        processTokenCandidates(candidateNum, 92, undefined, line, lineIdx, medianFontHeight, imageHeight, minScoreThreshold, evaluations);
      }
    }
  });

  // Sort evaluations by final score descending
  evaluations.sort((a, b) => b.finalScore - a.finalScore);

  return evaluations;
}

/**
 * Checks if a line is predominantly a date, time, or price line.
 */
function isDateOrTimeOrPriceLine(line: string): boolean {
  const upper = line.toUpperCase();
  if (/\b\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4}\b/.test(line)) return true;
  if (/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(line)) return true;
  if (/(TOTAL|SUMA|SUBTOTAL|IVA|EUROS|EUR|PRECIO)\s*[:=]?\s*\d+[,.]\d{2}/i.test(upper)) return true;
  return false;
}

/**
 * Evaluates a single token and its context to extract potential 3-digit candidates.
 */
function processTokenCandidates(
  rawToken: string,
  ocrConfidence: number,
  bbox: BoundingBox | undefined,
  lineText: string,
  lineIndex: number | undefined,
  medianFontHeight: number,
  imageHeight: number,
  minScoreThreshold: number,
  outEvaluations: CandidateEvaluation[]
): void {
  const cleanToken = rawToken.trim();
  const upperToken = cleanToken.toUpperCase();

  // RULE 1: DATE DETECTION (e.g. 13/08/2026, 13-08-26, 13 ago. 2026)
  const isDatePattern =
    /\b\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4}\b/.test(cleanToken) ||
    /^\d{1,2}[/\.-]\d{1,2}$/.test(cleanToken);

  // RULE 2: TIME DETECTION (e.g. 14:41:25, 14:27)
  const isTimePattern =
    /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(cleanToken);

  // RULE 3: PRICE / MONEY / TAX DETECTION (e.g. 16,45 €, 13,95 €, 10,50, TOTAL 16,00, IVA 10%)
  const isPricePattern =
    /\d+[,.]\d{2}/.test(cleanToken) ||
    /[,.]\d{2}\b/.test(cleanToken) ||
    /^(€|\$|EUR)\d+/i.test(cleanToken) ||
    /\d+(€|\$|EUR)$/i.test(cleanToken);

  // RULE 4: LONG CODE / IDENTIFIER PREFIX (e.g. T001006/5057, T001003-8329, T001005-5479, T001001-16179, REF, FAC)
  const isLongHeaderReference =
    /^T\d{3,}/i.test(cleanToken) ||
    /^[A-Z]*\d{4,}/i.test(cleanToken);

  // Extract all digit sequences from the token
  const allDigitSequences: string[] = cleanToken.match(/\d+/g) || [];
  const hasLongDigitSequence = allDigitSequences.some((seq: string) => seq.length >= 4);

  // Clean prefixes and extract digits
  let cleanedDigitsOnly = cleanToken
    .replace(/^(TICKET|PEDIDO|ORDEN|Nº|N°|NO|N|T|#|C|P|\.)/gi, '')
    .replace(/[^\d]/g, '');

  // Fallback: If not exact 3 digits, try normalized OCR confusion for 3-character tokens
  if (cleanedDigitsOnly.length !== 3 && cleanToken.length === 3) {
    const normalized = normalizeOcrDigits(cleanToken);
    const normDigits = normalized.replace(/[^\d]/g, '');
    if (normDigits.length === 3) {
      cleanedDigitsOnly = normDigits;
    }
  }

  // CRITICAL REQUIREMENT: If the token contained a digit sequence of 4 or more digits
  // (e.g. 5057, 1006, 8329, 16179, 2026), DO NOT allow extracting 3-digit sub-matches!
  if (hasLongDigitSequence) {
    if (cleanedDigitsOnly.length === 3 || (cleanedDigitsOnly.length >= 3 && cleanedDigitsOnly.length <= 4)) {
      const candidateStr = cleanedDigitsOnly.slice(-3);
      outEvaluations.push({
        candidate: candidateStr,
        confidenceScore: ocrConfidence / 100,
        sizeScore: 0,
        positionScore: 0,
        contextScore: 0,
        isolationScore: 0,
        finalScore: 0,
        accepted: false,
        rejectReason: `Descartado: procede de un código/secuencia larga (${rawToken})`,
        bbox,
        sourceToken: rawToken,
        lineText
      });
    }
    return;
  }

  // If token is a date, time, price, or reference header, explicitly reject
  if (isDatePattern || isTimePattern || isPricePattern || isLongHeaderReference) {
    if (isExactThreeDigits(cleanedDigitsOnly)) {
      let reason = 'Descartado: ';
      if (isDatePattern) reason += 'expresión de fecha';
      else if (isTimePattern) reason += 'expresión de hora';
      else if (isPricePattern) reason += 'expresión de precio/moneda/IVA';
      else if (isLongHeaderReference) reason += 'código de referencia de cabecera';

      outEvaluations.push({
        candidate: cleanedDigitsOnly,
        confidenceScore: ocrConfidence / 100,
        sizeScore: 0,
        positionScore: 0,
        contextScore: 0,
        isolationScore: 0,
        finalScore: 0,
        accepted: false,
        rejectReason: reason,
        bbox,
        sourceToken: rawToken,
        lineText
      });
    }
    return;
  }

  // Must be strictly 3 digits to be considered a candidate!
  if (!isExactThreeDigits(cleanedDigitsOnly)) {
    return;
  }

  const candidate = cleanedDigitsOnly;

  // SCORING CALCULATIONS
  // A. Confidence Score (0.0 to 1.0)
  const confidenceScore = Math.max(0, Math.min(1.0, ocrConfidence / 100));

  // B. Size Score (0.0 to 1.0 based on Bounding Box height vs median document font height)
  let sizeScore = 0.65; // baseline when bbox is not available
  if (bbox && bbox.y1 > bbox.y0) {
    const height = bbox.y1 - bbox.y0;
    const ratio = height / Math.max(1, medianFontHeight);
    if (ratio >= 2.0) sizeScore = 1.0; // Giant ticket number
    else if (ratio >= 1.5) sizeScore = 0.90;
    else if (ratio >= 1.1) sizeScore = 0.78;
    else if (ratio >= 0.9) sizeScore = 0.55;
    else sizeScore = 0.35;
  }

  // C. Context Score (0.0 to 1.0 based on surrounding keywords)
  let contextScore = 0.70; // neutral baseline
  const isPositiveContext =
    /(IN LOCAL|EN EL LOCAL|LOCAL|PARA LLEVAR|TAKE AWAY|TAKEAWAY|COCINA|BARRA|MESA|TURNO|PEDIDO|TICKET|ORDEN)/i.test(lineText);
  
  if (isPositiveContext) {
    contextScore = 1.0;
  } else if (/^(TICKET|PEDIDO|ORDEN|Nº|NO|#)?\s*\d{3}$/i.test(lineText)) {
    contextScore = 0.92; // Isolated ticket line
  }

  // Negative context penalties (only if the candidate token itself is directly related to financial/date terms)
  if (/(TOTAL|SUMA|IVA|SUBTOTAL|EUROS|PAGADO|GRACIAS|TELEFONO|CALLE|CIF|NIF)/i.test(lineText) && !isPositiveContext) {
    // If the line is purely financial, penalize
    if (/^(TOTAL|SUMA|IVA|SUBTOTAL)\s*[:=]?\s*\d/i.test(lineText)) {
      contextScore = 0.20;
    } else {
      contextScore = 0.45;
    }
  }

  // D. Isolation Score (0.0 to 1.0)
  let isolationScore = 0.75;
  const lineWords = lineText.trim().split(/\s+/).filter(Boolean);
  if (lineWords.length === 1) {
    isolationScore = 1.0; // Standalone number on its own line!
  } else if (lineWords.length <= 3) {
    isolationScore = 0.88;
  } else {
    isolationScore = 0.50;
  }

  // E. Position Score (0.0 to 1.0)
  let positionScore = 0.80;
  if (bbox && imageHeight > 0) {
    const centerY = (bbox.y0 + bbox.y1) / 2;
    const relY = centerY / imageHeight; // 0.0 top, 1.0 bottom
    if (relY >= 0.10 && relY <= 0.70) {
      positionScore = 1.0; // Ideal upper-middle ticket region
    } else if (relY > 0.70 && relY <= 0.88) {
      positionScore = 0.75;
    } else {
      positionScore = 0.55;
    }
  }

  // FINAL WEIGHTED SCORE
  const finalScore = Number(
    (
      confidenceScore * 0.25 +
      sizeScore * 0.30 +
      contextScore * 0.25 +
      isolationScore * 0.10 +
      positionScore * 0.10
    ).toFixed(2)
  );

  const accepted = finalScore >= minScoreThreshold && isExactThreeDigits(candidate);
  const rejectReason = accepted ? undefined : `Puntuación baja (${Math.round(finalScore * 100)}% < ${Math.round(minScoreThreshold * 100)}%)`;

  outEvaluations.push({
    candidate,
    confidenceScore,
    sizeScore,
    positionScore,
    contextScore,
    isolationScore,
    finalScore,
    accepted,
    rejectReason,
    bbox,
    sourceToken: rawToken,
    lineText
  });
}

function getLineForToken(word: string, lines: string[]): string {
  const matched = lines.find((l) => l.includes(word));
  return matched || word;
}

