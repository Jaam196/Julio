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
