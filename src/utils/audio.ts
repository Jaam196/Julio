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

  const spokenNumber = replaceNumbersWithWords(number, settings.lang);

  if (!isFullPhrase) {
    return `${spokenNumber}, ${spokenNumber}`;
  }

  const defaultIntro = DEFAULT_PHRASES[settings.lang]?.intro || "Atención por favor";
  const defaultTicketName = DEFAULT_PHRASES[settings.lang]?.ticketName || "Ticket número";
  const defaultOutro = DEFAULT_PHRASES[settings.lang]?.outro || "Su pedido está listo";

  const intro = settings.customIntro !== undefined && settings.customIntro !== '' ? settings.customIntro : defaultIntro;
  const ticketName = settings.customTicketName !== undefined && settings.customTicketName !== '' ? settings.customTicketName : defaultTicketName;
  const outro = settings.customOutro !== undefined && settings.customOutro !== '' ? settings.customOutro : defaultOutro;

  return `${intro}. ${ticketName} ${spokenNumber}. ${outro}.`;
}

/**
 * Play a beautiful electronic terminal chime using Web Audio API
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
      const now = audioCtx.currentTime;

      // Note 1: E5
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: A5
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.1);
      gain2.gain.setValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.4);

      setTimeout(() => {
        resolve();
      }, 400);
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
 * Speak the given text using Web Speech API
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

  // Cancel any active speech to avoid overlaps
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  
  // Custom independent voice volume from music
  utterance.volume = (settings.voiceVolume !== undefined ? settings.voiceVolume : 100) / 100;

  const langMap: Record<string, string> = {
    es: 'es-ES',
    en: 'en-US',
    ca: 'ca-ES',
    fr: 'fr-FR',
    it: 'it-IT',
    de: 'de-DE',
    pt: 'pt-PT'
  };

  utterance.lang = langMap[settings.lang] || 'es-ES';

  // Find matching voice or fallback based on language prefix/gender selection
  const voices = window.speechSynthesis.getVoices();
  let matchedVoice = voices.find((v) => v.voiceURI === settings.voiceURI);

  const langPrefix = settings.lang;

  if (!matchedVoice) {
    const filteredVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
    
    if (settings.voiceGender && settings.voiceGender !== 'all') {
      const isFemalePreferred = settings.voiceGender === 'female';
      const femaleNames = ["female", "zira", "hazel", "helena", "elsa", "salli", "karen", "moira", "tessa", "alice", "samantha", "siri", "sabina", "paola", "marisol", "victoria", "joana"];
      const maleNames = ["male", "david", "mark", "george", "pavel", "ravi", "julio", "stefano", "yannick", "dietmar", "daniel"];
      
      const genderMatched = filteredVoices.filter((v) => {
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
    
    if (!matchedVoice && filteredVoices.length > 0) {
      matchedVoice = filteredVoices[0];
    }
  }

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e);
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
}
