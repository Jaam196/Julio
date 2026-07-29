import { VoiceSettings } from '../types';

export const DEFAULT_PHRASES: Record<string, { intro: string; ticketName: string; outro: string }> = {
  es: {
    intro: "Atención por favor",
    ticketName: "Ticket número",
    outro: "Su pedido está listo"
  },
  en: {
    intro: "Attention please",
    ticketName: "Ticket number",
    outro: "Your order is ready"
  },
  ca: {
    intro: "Atenció si us plau",
    ticketName: "Tiquet número",
    outro: "La seva comanda està preparada"
  },
  fr: {
    intro: "Attention s'il vous plaît",
    ticketName: "Ticket numéro",
    outro: "Votre commande est prête"
  },
  it: {
    intro: "Attenzione per favore",
    ticketName: "Ticket numero",
    outro: "Il vostro ordine è pronto"
  },
  de: {
    intro: "Achtung bitte",
    ticketName: "Ticket Nummer",
    outro: "Ihre Bestellung ist fertig"
  },
  pt: {
    intro: "Atenção por favor",
    ticketName: "Senha número",
    outro: "Seu pedido está pronto"
  }
};

function numberToWordsEs(n: number): string {
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  
  const units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
  const tens = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  
  const parts: string[] = [];
  
  if (n >= 100) {
    parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }
  
  if (n >= 20) {
    if (n === 20) {
      parts.push("veinte");
    } else if (n < 30) {
      const u = n % 10;
      const specialVeinti = ["veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
      parts.push(specialVeinti[u - 1]);
    } else {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u > 0) {
        parts.push(`${tens[t]} y ${units[u]}`);
      } else {
        parts.push(tens[t]);
      }
    }
  } else if (n >= 10) {
    parts.push(teens[n - 10]);
  } else if (n > 0) {
    parts.push(units[n]);
  }
  
  return parts.filter(Boolean).join(" ");
}

function numberToWordsEn(n: number): string {
  if (n === 0) return "zero";
  const units = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  
  const parts: string[] = [];
  
  if (n >= 100) {
    parts.push(`${units[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  
  if (n >= 20) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u > 0) {
      parts.push(`${tens[t]}-${units[u]}`);
    } else {
      parts.push(tens[t]);
    }
  } else if (n >= 10) {
    parts.push(teens[n - 10]);
  } else if (n > 0) {
    parts.push(units[n]);
  }
  
  return parts.filter(Boolean).join(" ");
}

function numberToWordsCa(n: number): string {
  if (n === 0) return "zero";
  if (n === 100) return "cent";
  const units = ["", "un", "dos", "tres", "quatre", "cinc", "sis", "set", "vuit", "nou"];
  const teens = ["deu", "onze", "dotze", "tretze", "catorze", "quinze", "setze", "disset", "divuit", "dinou"];
  const tens = ["", "deu", "vint", "trenta", "quaranta", "cinquanta", "seixanta", "setanta", "vuitanta", "noranta"];
  const hundreds = ["", "cent", "dos-cents", "tres-cents", "quatre-cents", "cinc-cents", "sis-cents", "set-cents", "vuit-cents", "nou-cents"];
  
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }
  
  if (n >= 20) {
    if (n === 20) {
      parts.push("vint");
    } else if (n < 30) {
      parts.push(`vint-i-${units[n % 10]}`);
    } else {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u > 0) {
        parts.push(`${tens[t]}-${units[u]}`);
      } else {
        parts.push(tens[t]);
      }
    }
  } else if (n >= 10) {
    parts.push(teens[n - 10]);
  } else if (n > 0) {
    parts.push(units[n]);
  }
  
  return parts.filter(Boolean).join(" ");
}

function numberToWordsFr(n: number): string {
  if (n === 0) return "zéro";
  if (n === 100) return "cent";
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];
  
  const parts: string[] = [];
  if (n >= 100) {
    const h = Math.floor(n / 100);
    if (h === 1) {
      parts.push("cent");
    } else {
      parts.push(`${units[h]} cent`);
    }
    n %= 100;
  }
  
  if (n > 0) {
    if (n < 10) {
      parts.push(units[n]);
    } else if (n < 20) {
      parts.push(teens[n - 10]);
    } else if (n >= 20 && n < 70) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u === 1) {
        parts.push(`${tens[t]} et un`);
      } else if (u > 1) {
        parts.push(`${tens[t]}-${units[u]}`);
      } else {
        parts.push(tens[t]);
      }
    } else if (n >= 70 && n < 80) {
      const u = n % 10;
      if (u === 1) {
        parts.push("soixante et onze");
      } else {
        parts.push(`soixante-${teens[u]}`);
      }
    } else if (n >= 80 && n < 90) {
      const u = n % 10;
      if (u === 0) {
        parts.push("quatre-vingts");
      } else {
        parts.push(`quatre-vingt-${units[u]}`);
      }
    } else if (n >= 90 && n < 100) {
      const u = n % 10;
      parts.push(`quatre-vingt-${teens[u]}`);
    }
  }
  
  return parts.filter(Boolean).join(" ");
}

function numberToWordsIt(n: number): string {
  if (n === 0) return "zero";
  if (n === 100) return "cento";
  const units = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
  const teens = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
  const tens = ["", "dieci", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
  
  let result = "";
  if (n >= 100) {
    const h = Math.floor(n / 100);
    if (h === 1) {
      result += "cento";
    } else {
      result += units[h] + "cento";
    }
    n %= 100;
  }
  
  if (n >= 20) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    let tStr = tens[t];
    if (u === 1 || u === 8) {
      tStr = tStr.slice(0, -1);
    }
    result += tStr + units[u];
  } else if (n >= 10) {
    result += teens[n - 10];
  } else if (n > 0) {
    result += units[n];
  }
  
  return result;
}

function numberToWordsDe(n: number): string {
  if (n === 0) return "null";
  if (n === 100) return "einhundert";
  const units = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
  const teens = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
  const tens = ["", "zehn", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
  
  let result = "";
  if (n >= 100) {
    const h = Math.floor(n / 100);
    result += (h === 1 ? "ein" : units[h]) + "hundert";
    n %= 100;
  }
  
  if (n >= 20) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) {
      result += tens[t];
    } else {
      const uStr = u === 1 ? "ein" : units[u];
      result += uStr + "und" + tens[t];
    }
  } else if (n >= 10) {
    result += teens[n - 10];
  } else if (n > 0) {
    result += (n === 1 && result.length > 0) ? "eins" : units[n];
  }
  
  return result;
}

function numberToWordsPt(n: number): string {
  if (n === 0) return "zero";
  if (n === 100) return "cem";
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }
  
  if (n > 0) {
    if (n >= 20) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u > 0) {
        parts.push(`${tens[t]} e ${units[u]}`);
      } else {
        parts.push(tens[t]);
      }
    } else if (n >= 10) {
      parts.push(teens[n - 10]);
    } else {
      parts.push(units[n]);
    }
  }
  
  return parts.filter(Boolean).join(" e ");
}

export function numberToWords(numStr: string, lang: string): string {
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return numStr;
  if (num < 0 || num > 999) return numStr; // Fallback for longer figures
  
  switch (lang) {
    case 'es':
      return numberToWordsEs(num);
    case 'en':
      return numberToWordsEn(num);
    case 'ca':
      return numberToWordsCa(num);
    case 'fr':
      return numberToWordsFr(num);
    case 'it':
      return numberToWordsIt(num);
    case 'de':
      return numberToWordsDe(num);
    case 'pt':
      return numberToWordsPt(num);
    default:
      return numberToWordsEs(num);
  }
}

export function replaceNumbersWithWords(text: string, lang: string): string {
  return text.replace(/\d+/g, (match) => {
    const num = parseInt(match, 10);
    if (!isNaN(num) && num >= 0 && num <= 999) {
      return numberToWords(match, lang);
    }
    return match;
  });
}

export function formatAnnouncementText(
  number: string,
  settings: VoiceSettings,
  announcementCount: number
): string {
  const interval = settings.repeatPhraseInterval || 3;
  const isFullPhrase = (announcementCount - 1) % interval === 0;

  // Convert numbers to words in the target language
  let spokenNumber = replaceNumbersWithWords(number, settings.lang);

  // Clean hyphens or dashes in letter-number ticket codes (e.g., "A-12" -> "A 12")
  spokenNumber = spokenNumber.replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ])\s*[-–—]\s*/g, '$1 ');

  if (!isFullPhrase) {
    return `${spokenNumber}, ${spokenNumber}`;
  }

  const defaultIntro = DEFAULT_PHRASES[settings.lang]?.intro || "Atención por favor";
  const defaultTicketName = DEFAULT_PHRASES[settings.lang]?.ticketName || "Ticket número";
  const defaultOutro = DEFAULT_PHRASES[settings.lang]?.outro || "Su pedido está listo";

  const intro = settings.customIntro !== undefined && settings.customIntro !== '' ? settings.customIntro : defaultIntro;
  const ticketName = settings.customTicketName !== undefined && settings.customTicketName !== '' ? settings.customTicketName : defaultTicketName;
  const outro = settings.customOutro !== undefined && settings.customOutro !== '' ? settings.customOutro : defaultOutro;

  const cleanPart = (str: string) => str.trim().replace(/[.,;:]+$/, '');
  const parts = [cleanPart(intro), `${cleanPart(ticketName)} ${spokenNumber}`, cleanPart(outro)].filter(p => p && p.trim().length > 0);

  return parts.join(". ") + ".";
}

// Maintain cached voices and keep refreshed for instant availability
let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) {
      cachedVoices = v;
    }
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoices();
    };
  }
}

/**
 * Play a loud high-pitched bell chime (campana aguda y fuerte) using Web Audio API
 */
export function playNotificationSound(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        resolve();
        return;
      }
      
      const audioCtx = new AudioContextClass();

      const runSound = () => {
        const now = audioCtx.currentTime;

        // Strike 1 (0ms): High Bell D6 (1174.66 Hz) & A6 (1760 Hz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1174.66, now);
        gain1.gain.setValueAtTime(0.55, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.45);

        const osc1Harmonic = audioCtx.createOscillator();
        const gain1H = audioCtx.createGain();
        osc1Harmonic.type = 'triangle';
        osc1Harmonic.frequency.setValueAtTime(2637, now); // E7
        gain1H.gain.setValueAtTime(0.35, now);
        gain1H.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1Harmonic.connect(gain1H);
        gain1H.connect(audioCtx.destination);
        osc1Harmonic.start(now);
        osc1Harmonic.stop(now + 0.35);

        // Strike 2 (120ms): Loud high bell strike E6 (1318.5 Hz) & C7 (2093 Hz)
        const strike2Time = now + 0.12;
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.5, strike2Time);
        gain2.gain.setValueAtTime(0.70, strike2Time);
        gain2.gain.exponentialRampToValueAtTime(0.001, strike2Time + 0.55);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(strike2Time);
        osc2.stop(strike2Time + 0.55);

        const osc2High = audioCtx.createOscillator();
        const gain2H = audioCtx.createGain();
        osc2High.type = 'sine';
        osc2High.frequency.setValueAtTime(2093, strike2Time);
        gain2H.gain.setValueAtTime(0.50, strike2Time);
        gain2H.gain.exponentialRampToValueAtTime(0.001, strike2Time + 0.50);
        osc2High.connect(gain2H);
        gain2H.connect(audioCtx.destination);
        osc2High.start(strike2Time);
        osc2High.stop(strike2Time + 0.50);

        // Strike 3 (240ms): Final bright sparkling bell accent G7 (3135.96 Hz)
        const strike3Time = now + 0.24;
        const osc3 = audioCtx.createOscillator();
        const gain3 = audioCtx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(3135.96, strike3Time);
        gain3.gain.setValueAtTime(0.40, strike3Time);
        gain3.gain.exponentialRampToValueAtTime(0.001, strike3Time + 0.40);
        osc3.connect(gain3);
        gain3.connect(audioCtx.destination);
        osc3.start(strike3Time);
        osc3.stop(strike3Time + 0.40);

        setTimeout(() => {
          resolve();
        }, 650);
      };

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => runSound()).catch(() => {
          runSound();
        });
      } else {
        runSound();
      }
    } catch (err) {
      console.warn('Web Audio not allowed or failed:', err);
      resolve();
    }
  });
}

/**
 * Trigger mobile vibration
 */
export function triggerVibration(enabled: boolean) {
  if (enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([120, 80, 120]);
    } catch (err) {
      console.warn('Vibration failed:', err);
    }
  }
}

/**
 * Speak the given text using Web Speech API with strict language matching
 */
export function speakText(
  text: string,
  settings: VoiceSettings,
  onStart?: () => void,
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('SpeechSynthesis not supported');
    onEnd?.();
    return null;
  }

  // Ensure speech synthesis is active (resume if paused/suspended by browser)
  if (window.speechSynthesis.paused) {
    try { window.speechSynthesis.resume(); } catch (e) {}
  }
  if (window.speechSynthesis.speaking) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  // Sanitize text to remove hyphens in ticket codes that confuse TTS engines
  let sanitizedText = text.replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ])\s*[-–—]\s*/g, '$1 ');
  
  const utterance = new SpeechSynthesisUtterance(sanitizedText);
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.volume = (settings.voiceVolume !== undefined ? settings.voiceVolume : 100) / 100;

  const targetLangShort = (settings.lang || 'es').toLowerCase().split(/[-_]/)[0];

  const langMap: Record<string, string> = {
    es: 'es-ES',
    en: 'en-US',
    ca: 'ca-ES',
    fr: 'fr-FR',
    it: 'it-IT',
    de: 'de-DE',
    pt: 'pt-PT'
  };

  // Get freshest available voices (using cached or current)
  let voices = refreshVoices();
  if (voices.length === 0 && typeof window.speechSynthesis.getVoices === 'function') {
    voices = window.speechSynthesis.getVoices();
  }

  let matchedVoice: SpeechSynthesisVoice | undefined = undefined;

  // 1. Check if configured voiceURI exists AND strictly belongs to the requested language
  if (settings.voiceURI && voices.length > 0) {
    const candidate = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (candidate) {
      const candidateLangShort = candidate.lang.toLowerCase().split(/[-_]/)[0];
      if (candidateLangShort === targetLangShort) {
        matchedVoice = candidate;
      }
    }
  }

  // 2. Fallback: Search STRICTLY among voices of target language
  if (!matchedVoice && voices.length > 0) {
    const langVoices = voices.filter((v) => {
      const vLangShort = v.lang.toLowerCase().split(/[-_]/)[0];
      return vLangShort === targetLangShort;
    });

    if (settings.voiceGender && settings.voiceGender !== 'all' && langVoices.length > 0) {
      const isFemalePreferred = settings.voiceGender === 'female';
      const femaleNames = ["female", "zira", "hazel", "helena", "elsa", "salli", "karen", "moira", "tessa", "alice", "samantha", "siri", "sabina", "paola", "marisol", "victoria", "joana", "monica", "lucia", "marta", "esmeralda"];
      const maleNames = ["male", "david", "mark", "george", "pavel", "ravi", "julio", "stefano", "yannick", "dietmar", "daniel", "pablo", "jorge", "diego", "carlos"];

      const genderMatched = langVoices.filter((v) => {
        const nameLower = v.name.toLowerCase();
        if (isFemalePreferred) {
          return femaleNames.some(name => nameLower.includes(name)) && !maleNames.some(name => nameLower.includes(name));
        } else {
          return maleNames.some(name => nameLower.includes(name)) && !femaleNames.some(name => nameLower.includes(name));
        }
      });

      if (genderMatched.length > 0) {
        matchedVoice = genderMatched[0];
      }
    }

    if (!matchedVoice && langVoices.length > 0) {
      matchedVoice = langVoices[0];
    }
  }

  if (matchedVoice) {
    utterance.voice = matchedVoice;
    utterance.lang = matchedVoice.lang;
  } else {
    // Force strict target language BCP-47 tag so browser speech engine never uses English voice
    utterance.lang = langMap[targetLangShort] || 'es-ES';
  }

  // Keep-alive ticker interval to prevent Chrome/Tizen speech engine from suspending during long vocalizations
  let resumeInterval: any = null;

  const cleanup = () => {
    if (resumeInterval) {
      clearInterval(resumeInterval);
      resumeInterval = null;
    }
  };

  utterance.onstart = () => {
    resumeInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          cleanup();
        }
      }
    }, 3000);
    onStart?.();
  };

  utterance.onend = () => {
    cleanup();
    onEnd?.();
  };

  utterance.onerror = (e) => {
    cleanup();
    console.warn('SpeechSynthesis error:', e);
    onEnd?.();
  };

  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Error launching speech synthesis:', err);
    cleanup();
    onEnd?.();
  }

  return utterance;
}
