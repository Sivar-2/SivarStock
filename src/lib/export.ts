import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Sanitiza valores de texto para prevenir inyección de fórmulas en CSV/Excel
 * Si un valor inicia con =, +, -, @, \t, se antepone una comilla simple '
 */
export function sanitizeCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  const rawStr = String(val);
  // Verificar si inicia con caracteres de control de fórmula o tabulación
  if (/^[=+\-@\t\r]/.test(rawStr) || /^[=+\-@\t\r]/.test(rawStr.trim())) {
    return `'${rawStr}`;
  }
  return rawStr;
}

/**
 * Genera contenido CSV con sanitización y escape de comillas
 */
export function generateCsv(columns: { key: string; header: string }[], data: any[]): string {
  const headerRow = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const rows = data.map(item => {
    return columns.map(c => {
      const rawVal = item[c.key];
      const safeVal = sanitizeCellValue(rawVal);
      return `"${safeVal.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

/**
 * Genera un buffer de Excel (.xlsx) con metadatos y estilo
 */
export function generateExcelBuffer(
  title: string,
  columns: { key: string; header: string }[],
  data: any[]
): Uint8Array {
  const sheetData = data.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach(col => {
      const val = row[col.key];
      obj[col.header] = typeof val === 'number' ? val : sanitizeCellValue(val);
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetData);

  // Auto-ajuste de anchos de columna
  const colWidths = columns.map(c => {
    const maxLen = Math.max(
      c.header.length,
      ...data.map(d => String(d[c.key] || '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 30));

  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

/**
 * Genera un documento PDF profesional con membrete empresarial y tabla formateada
 */
export function generatePdfDoc(
  title: string,
  subtitle: string,
  columns: { key: string; header: string }[],
  data: any[],
  companyName: string = 'SivarStock Manufactura S.A.'
): jsPDF {
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });

  // Encabezado Corporativo
  doc.setFillColor(36, 64, 52); // Verde Militar #244034
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sistema de Inventario SivarStock | Generado: ${new Date().toLocaleString('es-SV')}`, 14, 18);

  // Título del Reporte
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 34);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 40);
  }

  // Preparar Filas de la Tabla
  const tableHeaders = [columns.map(c => c.header)];
  const tableRows = data.map(item => {
    return columns.map(c => {
      const val = item[c.key];
      return val !== null && val !== undefined ? String(val) : '-';
    });
  });

  (doc as any).autoTable({
    startY: subtitle ? 45 : 39,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [47, 75, 58], // Verde Militar institucional
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (dataHook: any) => {
      // Pie de página con numeración
      const pageCount = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${dataHook.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.getWidth() - 30,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  return doc;
}
