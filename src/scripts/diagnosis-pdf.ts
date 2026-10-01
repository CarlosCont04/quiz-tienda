import { jsPDF } from 'jspdf';
import definition from '../../shared/quiz.json' with { type: 'json' };
import { calculateResult, type Answer } from './scoring.ts';

const colors = { navy: '#102a43', orange: '#f39200', cream: '#fff8ee', text: '#465a6b', muted: '#66788a', border: '#e5ebef' };
const normalize = (text: string) => text.replace(/[\u2010-\u2015]/g, '-');

export function diagnosisFilename(date = new Date()): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `diagnostico-dependencia-${day}.pdf`;
}

/** Generación local con texto seleccionable; no envía datos ni llama a la API. */
export function createDiagnosisPdf(answers: Answer[], generatedAt = new Date()): jsPDF {
  const result = calculateResult(answers);
  const byId = new Map(answers.map(answer => [answer.questionId, answer.value]));
  const critical = result.areas.filter(area => result.criticalAreas.includes(area.id));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title: 'Diagnóstico - Test de Dependencia', author: 'El que tenga tienda', subject: result.title });
  doc.setCreationDate(generatedAt);
  const margin = 22, width = 166, bottom = 270;
  let y = 48;

  function header() {
    doc.setFillColor(colors.navy); doc.rect(0, 0, 210, 34, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor('#ffffff');
    doc.text('EL QUE TENGA TIENDA', margin, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#dce7f0');
    doc.text('Tu diagnóstico inicial | Test de Dependencia', margin, 25);
    doc.setFillColor(colors.orange); doc.rect(0, 34, 210, 1.5, 'F');
    y = 48;
  }
  function ensureSpace(height: number) {
    if (y + height > bottom) { doc.addPage(); header(); }
  }
  function lines(text: string, size = 10, bold = false, maxWidth = width): string[] {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    return doc.splitTextToSize(normalize(text), maxWidth) as string[];
  }
  function paragraph(text: string, options: { size?: number; bold?: boolean; color?: string; gap?: number } = {}) {
    const size = options.size ?? 10;
    const wrapped = lines(text, size, options.bold);
    const lineHeight = size * 0.3528 * 1.45;
    ensureSpace(wrapped.length * lineHeight + (options.gap ?? 4));
    doc.setTextColor(options.color ?? colors.text);
    doc.text(wrapped, margin, y, { lineHeightFactor: 1.45 });
    y += wrapped.length * lineHeight + (options.gap ?? 4);
  }
  function section(text: string) {
    ensureSpace(24);
    doc.setDrawColor(colors.border); doc.line(margin, y, margin + width, y);
    y += 9;
    paragraph(text, { size: 14, bold: true, color: colors.navy, gap: 4 });
  }

  header();
  paragraph(`Fecha del test: ${generatedAt.toLocaleDateString('es-MX')}`, { size: 9, color: colors.muted, gap: 6 });
  doc.setFillColor(colors.cream); doc.roundedRect(margin, y - 3, width, 32, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(colors.navy);
  doc.text(`${result.percentage}%`, margin + 8, y + 12);
  doc.setFontSize(14); doc.text(result.title, margin + 48, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`${result.score} de ${result.maxScore} puntos de dependencia`, margin + 48, y + 16);
  y += 38;
  paragraph(result.description, { gap: 7 });
  section('Tu negocio, área por área');
  paragraph('Más alto = más dependencia', { size: 9, color: colors.muted, gap: 3 });
  for (const area of result.areas) {
    ensureSpace(15);
    const priority = result.criticalAreas.includes(area.id);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(colors.navy);
    doc.text(area.label, margin, y);
    doc.text(`${area.percentage}%`, margin + width, y, { align: 'right' });
    if (priority) {
      doc.setFontSize(8); doc.setTextColor('#845000'); doc.text('PRIORIDAD', margin + 40, y);
    }
    doc.setFillColor(colors.border); doc.roundedRect(margin, y + 3, width, 3, 1, 1, 'F');
    if (area.percentage > 0) {
      doc.setFillColor(priority ? '#be7100' : colors.navy);
      doc.rect(margin, y + 3, width * area.percentage / 100, 3, 'F');
    }
    y += 15;
  }

  const priorityTitle = critical.length ? `${critical.length > 1 ? 'Áreas críticas' : 'Área crítica'}: ${critical.map(area => area.label).join(', ')}` : 'Sin un área crítica de dependencia';
  const explanation = critical.length > 1
    ? 'Estas áreas comparten el mayor porcentaje de dependencia. Elige una para empezar.'
    : critical.length === 0 ? 'Todas tus áreas tienen un índice de 0 %. Tu siguiente reto es trabajar en escala, equipo y estrategia.' : '';
  const recommendations = critical.map(area => `${area.label}. ${area.nextStep}`);
  // Mantener las recomendaciones y su encabezado en la misma página.
  const paragraphHeight = (text: string, size = 10, bold = false) => lines(text, size, bold).length * size * 0.3528 * 1.45 + 4;
  const recommendationsHeight = 9 + paragraphHeight('Por dónde empezar', 14, true)
    + paragraphHeight(priorityTitle, 11, true) + (explanation ? paragraphHeight(explanation) : 0)
    + recommendations.reduce((height, text) => height + paragraphHeight(text), 0);
  ensureSpace(recommendationsHeight);
  section('Por dónde empezar');
  paragraph(priorityTitle, { size: 11, bold: true, color: colors.navy });
  if (explanation) paragraph(explanation);
  for (const recommendation of recommendations) paragraph(recommendation);

  y += 4;
  ensureSpace(42);
  section('Tus respuestas al test');
  for (const question of definition.questions) {
    const value = byId.get(question.id)!;
    const questionText = `${question.id}. ${question.text}`;
    const responseText = `Respuesta: ${question.options[value]} (${value} / 3 puntos)`;
    ensureSpace(lines(questionText, 10, true).length * 5.12 + lines(responseText).length * 5.12 + 12);
    paragraph(questionText, { bold: true, color: colors.navy, gap: 2 });
    paragraph(responseText, { gap: 7 });
  }
  paragraph('Este test es una primera lectura basada en tus respuestas; no sustituye un diagnóstico detallado de tu negocio.', { size: 9, color: colors.muted, gap: 0 });

  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page); doc.setDrawColor(colors.border); doc.line(margin, 280, margin + width, 280);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(colors.muted);
    doc.text('elquetengatienda.com | ' + definition.version, margin, 287);
    doc.text(`${page} / ${count}`, margin + width, 287, { align: 'right' });
  }
  return doc;
}
