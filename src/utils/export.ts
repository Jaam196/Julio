import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Ticket } from '../types';

export function formatTimeDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function exportToPDF(tickets: Ticket[], titleType: 'delivered' | 'missing' | 'pending_history') {
  const doc = new jsPDF();
  let title = '';
  if (titleType === 'delivered') title = 'Historial de Tickets Entregados';
  else if (titleType === 'missing') title = 'Historial de Tickets Desaparecidos';
  else title = 'Historial de Tickets Pendientes';
  
  // Draw top slate background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GESTOR DE TICKETS', 15, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reporte: ${title}`, 15, 28);
  doc.text(`Fecha: ${new Date().toLocaleString()}`, 130, 28);
  
  // Statistics/Summary Section
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Historial', 15, 48);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Tickets: ${tickets.length}`, 15, 55);
  
  const avgWait = tickets.length > 0 
    ? formatTimeDuration(Math.round(tickets.reduce((acc, t) => acc + (t.totalTime || 0), 0) / tickets.length))
    : '0s';
  doc.text(`Tiempo Promedio de Espera: ${avgWait}`, 100, 55);
  
  // Separator line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(15, 60, 195, 60);
  
  // Table headers
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(15, 65, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Ticket #', 20, 70.5);
  doc.text('Hora Entrada', 55, 70.5);
  doc.text(titleType === 'pending_history' ? 'Paso a Pendientes' : 'Hora Salida', 105, 70.5);
  doc.text('Tiempo Espera', 160, 70.5);
  
  // Table rows
  doc.setTextColor(51, 65, 85); // slate-700
  doc.setFont('helvetica', 'normal');
  let y = 79;
  const pageHeight = 297;
  
  tickets.forEach((t, index) => {
    // Page boundary check
    if (y > pageHeight - 15) {
      doc.addPage();
      // Draw headers on new page
      doc.setFillColor(30, 41, 59);
      doc.rect(15, 15, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Ticket #', 20, 20.5);
      doc.text('Hora Entrada', 55, 20.5);
      doc.text(titleType === 'pending_history' ? 'Paso a Pendientes' : 'Hora Salida', 105, 20.5);
      doc.text('Tiempo Espera', 160, 20.5);
      
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      y = 29;
    }
    
    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, y - 5, 180, 7, 'F');
    }
    
    doc.text(String(t.number), 20, y);
    doc.text(formatDate(t.createdAt), 55, y);
    doc.text(titleType === 'pending_history' ? (t.pendingAt ? formatDate(t.pendingAt) : '-') : (t.completedAt ? formatDate(t.completedAt) : '-'), 105, y);
    doc.text(t.totalTime !== undefined ? formatTimeDuration(t.totalTime) : '-', 160, y);
    
    y += 7;
  });
  
  // Save PDF
  doc.save(`tickets_${titleType}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportToExcel(tickets: Ticket[], titleType: 'delivered' | 'missing' | 'pending_history') {
  const data = tickets.map((t) => {
    let estadoStr = '';
    if (t.status === 'delivered') estadoStr = 'Entregado';
    else if (t.status === 'missing') estadoStr = 'Desaparecido';
    else if (t.status === 'deleted_pending') estadoStr = 'Eliminado de Pendientes';
    else estadoStr = 'Pendiente Procesado';

    return {
      'Número de Ticket': t.number,
      'Estado': estadoStr,
      'Fecha de Entrada': formatDate(t.createdAt),
      'Paso a Pendientes': t.pendingAt ? formatDate(t.pendingAt) : '-',
      'Fecha de Salida': t.completedAt ? formatDate(t.completedAt) : '-',
      'Tiempo Total Espera (segundos)': t.totalTime || 0,
      'Tiempo de Espera Formateado': t.totalTime !== undefined ? formatTimeDuration(t.totalTime) : '-',
    };
  });
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');
  
  // Set custom column widths for nice readability
  worksheet['!cols'] = [
    { wch: 18 }, // Ticket #
    { wch: 22 }, // Estado
    { wch: 22 }, // Entrada
    { wch: 22 }, // Paso a Pendientes
    { wch: 22 }, // Salida
    { wch: 30 }, // Segundos
    { wch: 26 }, // Formateado
  ];
  
  XLSX.writeFile(workbook, `tickets_${titleType}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportAppDocumentationAndPromptPDF() {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const maxContentWidth = pageWidth - margin * 2;
  let y = 15;

  const drawPageHeaderFooter = () => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 10, pageWidth - margin, 10);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.text('DOCUMENTACIÓN Y PROMPT DEL SISTEMA DE GESTIÓN DE TURNOS', margin, 8);
    doc.text(new Date().toLocaleDateString('es-ES'), pageWidth - margin, 8, { align: 'right' });
  };

  const checkOverflow = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawPageHeaderFooter();
    }
  };

  // COVER / HEADER BLOCK
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('MANUAL DE USUARIO Y PROMPT DE SISTEMA (IA)', margin, 18);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Sistema de Gestión de Turnos, Pantalla Gigante, OCR & Red Multidispositivo', margin, 26);
  doc.text(`Fecha de emisión: ${new Date().toLocaleString('es-ES')}`, margin, 34);

  y = 50;

  const addHeading = (text: string, level: 1 | 2 = 1) => {
    checkOverflow(12);
    if (level === 1) {
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, maxContentWidth, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(text, margin + 3, y + 5.5);
      y += 12;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(text, margin, y);
      y += 6;
    }
  };

  const addParagraph = (text: string, isBullet = false) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    const prefix = isBullet ? '• ' : '';
    const lines = doc.splitTextToSize(prefix + text, isBullet ? maxContentWidth - 4 : maxContentWidth);
    const lineHeight = 4.5;
    const blockHeight = lines.length * lineHeight + 2;

    checkOverflow(blockHeight);

    lines.forEach((line: string, idx: number) => {
      const indent = isBullet && idx > 0 ? margin + 4 : margin;
      doc.text(line, indent, y);
      y += lineHeight;
    });
    y += 1.5;
  };

  // SECTION 1: MANUAL Y FUNCIONAMIENTO DE LA APLICACIÓN
  addHeading('1. RESUMEN Y MANUAL DE FUNCIONAMIENTO DE LA APLICACIÓN');

  addParagraph('Esta aplicación es un ecosistema integral de gestión de turnos, pantalla de atención al cliente y escaneo óptico de tickets (OCR), diseñado para funcionar tanto en un solo equipo como en red local multidispositivo (PC, Tablets, Mobiles y Smart TVs) sin depender de servidores externos en la nube.');

  addHeading('1.1 Gestión de Turnos y Modos de Llamada', 2);
  addParagraph('Creación instantánea de tickets manuales o automáticos con rango personalizable de 1 a 5 dígitos.', true);
  addParagraph('Llamada por voz sintetizada TTS multilenguaje con configuración de género, volumen, velocidad y tono de la voz.', true);
  addParagraph('Generación de señal sonora sintetizada (Bong / Chime) para captar la atención en ambientes ruidosos.', true);
  addParagraph('Flujo de estados: Pendientes → Prontos para Retiro → Entregados / Desaparecidos.', true);
  addParagraph('Histórico persistente con soporte para restauración, búsqueda rápida y exportación a PDF y Excel.', true);

  addHeading('1.2 Escáner de Tickets por Cámara y Algoritmo OCR Adaptativo', 2);
  addParagraph('Escaneo directo mediante webcam o cámara de dispositivos móviles en tiempo real.', true);
  addParagraph('Procesamiento de imagen offscreen canvas con ajuste de brillo, contraste, binarización y enfoque.', true);
  addParagraph('Región de Interés (ROI) recortable para centrar la lectura en números de ticket impresos.', true);
  addParagraph('Carga instantánea por lote (<100ms por ticket) para subir fotos de múltiples tickets de ejemplo.', true);
  addParagraph('Sistema de Inteligencia Adaptativa: la app memoriza errores de lectura frecuentes y calibraciones de tipografía térmica.', true);

  addHeading('1.3 Ecosistema Multidispositivo e Interconexión Wi-Fi Local', 2);
  addParagraph('Sincronización por WebSocket directo en red local sin necesidad de Internet ni servidores externos.', true);
  addParagraph('Emparejamiento rápido mediante código único de 4 dígitos.', true);
  addParagraph('Modo PC Servidor: actúa como nodo central de datos, audio y coordinación de red.', true);
  addParagraph('Modo Consola Móvil: convierte tablets y teléfonos en mandos a distancia para llamar o despachar turnos.', true);
  addParagraph('Modo Pantalla Pública TV: interfaz limpia de alta legibilidad para Smart TV o monitores para clientes.', true);

  addHeading('1.4 Personalización Visual, Vídeos, Anuncios y Salida HDMI', 2);
  addParagraph('Librería de temas visuales (Oscuro Pro, Neón, Mármol, Menta, Maderado y personalizado).', true);
  addParagraph('Integración de vídeos promocionales en bucle o carruseles de imágenes publicitarias.', true);
  addParagraph('Barra de anuncios marqueina con texto desplazable en la parte inferior de la pantalla.', true);
  addParagraph('Salida a pantalla secundaria/HDMI limpia para conectar un televisor de sala de espera.', true);

  // SECTION 2: PROMPT OPERATIVO Y DIRECTIVAS DE SISTEMA
  y += 3;
  addHeading('2. PROMPT DE SISTEMA Y DIRECTIVAS OPERATIVAS DE INTELIGENCIA ARTIFICIAL');

  addParagraph('A continuación se detalla la especificación del Prompt de Sistema (System Prompt) que rige la construcción, arquitectura y comportamiento de la inteligencia artificial de la aplicación:');

  addHeading('2.1 Identidad y Directivas de Arquitectura', 2);
  addParagraph('Rol del Agente: Agente Inteligente de Desarrollo Full-Stack para sistemas de gestión en tiempo real.', true);
  addParagraph('Alineación Estricta: Respetar al 100% la intención funcional descrita por el usuario sin agregar funciones no solicitadas que carguen la interfaz.', true);
  addParagraph('Calidad de Código: Arquitectura modular con componentes React limpios, TypeScript estricto sin tipos any ambiguos y manejo de errores resiliente.', true);

  addHeading('2.2 Estándares Visuales Anti-Slop (Diseño y UI)', 2);
  addParagraph('Estructura Limpia: Sin tarjetas anidadas sin propósito, sin degradados estridentes ni sombras difusas innecesarias.', true);
  addParagraph('Jerarquía Tipográfica: Contraste matemático entre títulos display y texto body con legibilidad optimizada.', true);
  addParagraph('Accesibilidad: Cumplimiento de estándar WCAG AA con contraste mínimo 4.5:1 para texto de legibilidad rápida.', true);
  addParagraph('Adaptabilidad Responsiva: Diseño fluido con soporte para móviles (touch min 44px) y pantallas gigantes de hasta 4K.', true);

  addHeading('2.3 Resiliencia y Rendimiento en Tiempo Real', 2);
  addParagraph('Cero Latencia: Actualizaciones directas en DOM / React state con renderizado optimizado.', true);
  addParagraph('Persistencia Híbrida: Resguardo en localStorage y sincronización WebSocket bidireccional inmediata.', true);
  addParagraph('Tolerancia a Desconexiones: Reconexión automática transparente en red Wi-Fi sin pérdida de tickets.', true);

  // SECTION 3: ARQUITECTURA TÉCNICA Y CÓMO ESTÁ HECHA LA APLICACIÓN
  y += 3;
  addHeading('3. ARQUITECTURA TÉCNICA Y CÓMO ESTÁ HECHA LA APLICACIÓN');

  addParagraph('La aplicación sigue un modelo híbrido Full-Stack optimizado para ejecutarse localmente con latencia ultra baja.');

  addHeading('3.1 Tecnologías y Librerías Utilizadas', 2);
  addParagraph('Frontend: React 18, TypeScript, Tailwind CSS, Lucide React (Iconografía), Motion/React (Animaciones).', true);
  addParagraph('Servidor y Red: Node.js + Express (Puerto 3000) con servidor WebSocket (ws) para sincronización multidispositivo en red Wi-Fi local.', true);
  addParagraph('Motor OCR: Tesseract.js v5 con preprocesamiento de imágenes en Offscreen Canvas (Escalado x3, Binarización Otsu, ROI dinamica).', true);
  addParagraph('Sintetizador de Audio: Web Speech API (TTS voz humana) + Web Audio API (Osciladores sinusoidales para tonos Chime/Bong).', true);
  addParagraph('Persistencia y Exportación: LocalStorage con copias de seguridad JSON, jsPDF para informes PDF y SheetJS (XLSX) para hojas de cálculo.', true);

  addHeading('3.2 Flujo de Datos y Sincronización Multidispositivo', 2);
  addParagraph('1. El PC Servidor inicia un WebSocket Server local y genera un código de emparejamiento de 4 dígitos.', true);
  addParagraph('2. Las tablets/teléfonos o Smart TVs se conectan al IP/WS del servidor enviando su rol (controller / pantalla).', true);
  addParagraph('3. Cada cambio en la cola de tickets (creación, llamada, despacho, OCR) se emite inmediatamente a todos los clientes conectados.', true);
  addParagraph('4. Las pantallas públicas de TV reciben la actualización e inician la animación visual y voz sintetizada en tiempo real.', true);

  // SECTION 4: CÓDIGO FUENTE PRINCIPAL Y ESTRUCTURA DE IMPLEMENTACIÓN
  y += 3;
  addHeading('4. CÓDIGO FUENTE PRINCIPAL Y ESTRUCTURA DE IMPLEMENTACIÓN');

  const addCodeBlock = (title: string, codeText: string) => {
    checkOverflow(15);
    doc.setFillColor(30, 41, 59); // Header slate-800
    doc.rect(margin, y, maxContentWidth, 6, 'F');
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.setTextColor(248, 250, 252);
    doc.text(`[CÓDIGO FUENTE] ${title}`, margin + 3, y + 4.2);
    y += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);

    const lines = doc.splitTextToSize(codeText, maxContentWidth - 6);
    const blockHeight = lines.length * 3.5 + 4;

    checkOverflow(blockHeight);

    doc.setFillColor(15, 23, 42); // slate-900 background
    doc.rect(margin, y, maxContentWidth, blockHeight, 'F');

    lines.forEach((line: string) => {
      doc.text(line, margin + 3, y + 3.2);
      y += 3.5;
    });
    y += 5;
  };

  addCodeBlock('1. Servidor WebSocket de Sincronización Local (server.ts)', `// Express + WebSocket Server para red local Wi-Fi
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = app.listen(3000, '0.0.0.0');
const wss = new WebSocketServer({ server });

interface Client {
  id: string;
  ws: WebSocket;
  role: 'server' | 'controller' | 'pantalla';
  pairedCode: string;
}

const clients = new Map<string, Client>();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'register') {
      clients.set(data.clientId, { id: data.clientId, ws, role: data.role, pairedCode: data.code });
      broadcastState(data.code);
    } else if (data.type === 'sync_tickets') {
      broadcastTicketsToClients(data.code, data.tickets, data.activeTicket);
    }
  });
});`);

  addCodeBlock('2. Algoritmo de Preprocesamiento e Inferencia OCR (CameraOCR.tsx)', `// Preprocesamiento de imagen en Canvas para optimizar Tesseract.js
const processImageForOCR = (canvas: HTMLCanvasElement): string => {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Conversión a escala de grises y binarización por umbral adaptativo
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const threshold = avg > 128 ? 255 : 0; // Otsu thresholding
    data[i] = threshold;     // Red
    data[i + 1] = threshold; // Green
    data[i + 2] = threshold; // Blue
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

const runOCRInference = async (imageSrc: string) => {
  const worker = await createWorker('spa');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
  });
  const { data: { text } } = await worker.recognize(imageSrc);
  return parseDetectedNumber(text);
};`);

  addCodeBlock('3. Sintetizador de Voz TTS y Generador Audio Chime (useSpeechSynthesis.ts)', `// Síntesis de voz humana multilenguaje y señal sonora Web Audio API
export const playChimeNotification = () => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc1 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
  osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

  osc1.connect(gain);
  gain.connect(audioCtx.destination);
  osc1.start();
  osc1.stop(audioCtx.currentTime + 0.8);
};

export const announceTicketVoice = (ticketNumber: string, voiceName?: string) => {
  const utterance = new SpeechSynthesisUtterance(\`Número \${ticketNumber}, por favor acérquese al mostrador\`);
  utterance.lang = 'es-ES';
  if (voiceName) {
    const voice = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
    if (voice) utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
};`);

  addCodeBlock('4. Gestión de Modos de Dispositivo y Conmutador de Roles (App.tsx)', `// Manejador central de selección de funciones de dispositivo
const handleSelectMode = (mode: 'local' | 'server' | 'mobile_control' | 'public_display') => {
  if (mode === 'local') {
    setDeviceMode('local');
    localStorage.setItem('deviceMode', 'local');
    disconnectWebSocket();
  } else if (mode === 'server') {
    setDeviceMode('server');
    localStorage.setItem('deviceMode', 'server');
    startLocalServer();
  } else if (mode === 'mobile_control' || mode === 'public_display') {
    const role = mode === 'public_display' ? 'pantalla' : 'controller';
    setDeviceMode('client');
    setClientRole(role);
    localStorage.setItem('deviceMode', 'client');
    localStorage.setItem('clientRole', role);
    connectWebSocket('client', savedCode, savedIP);
  }
};`);

  // Save PDF file
  const fileName = `Documentacion_Prompt_y_Codigo_Sistema_Turnos_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

