'use client';

import { WAIVER_VERSION as _WAIVER_VERSION, WAIVER_TEXT as _WAIVER_TEXT } from '@/lib/waiver-text';
export { WAIVER_VERSION, WAIVER_TEXT } from '@/lib/waiver-text';

export interface PdfContext {
  signerName: string;
  signerEmail?: string;
  role: 'participant' | 'guardian';
  participantsCovered: string[];
  guardianRelationship?: string;
  agreedAt: string;
  ipAddress?: string;
  userAgent?: string;
  tourType?: string;
  locationName?: string;
  tourDate?: string;
  bookingRef?: string;
  signatureDataUrl: string;
}

export async function generateWaiverPdf(ctx: PdfContext): Promise<string> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 15;

  const line = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color = '#111111') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, contentW);
    doc.text(lines, margin, y);
    y += (lines.length * size * 0.352) + 2;
  };

  const checkPage = (needed = 20) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 15;
    }
  };

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(31, 90, 67);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#FFFFFF');
  doc.text('Florida Mountain Bike Trail Guided Tours', margin, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Waiver of Liability & Release of Claims — Evidence Record', margin, 17);
  y = 28;

  // ── Waiver version ──────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#666666');
  doc.text(`Waiver Version: ${_WAIVER_VERSION}   |   Generated: ${new Date().toUTCString()}`, margin, y);
  y += 6;
  line();

  // ── Booking context ─────────────────────────────────────────────────────────
  addText('BOOKING INFORMATION', 9, 'bold', '#444444');
  if (ctx.bookingRef) addText(`Booking Reference: ${ctx.bookingRef}`, 9);
  if (ctx.tourType)   addText(`Tour Type: ${ctx.tourType === 'mtb' ? 'Mountain Bike Tour' : 'Scenic Paved Trail Tour'}`, 9);
  if (ctx.locationName) addText(`Location: ${ctx.locationName}`, 9);
  if (ctx.tourDate)   addText(`Tour Date: ${ctx.tourDate}`, 9);
  y += 2;
  line();

  // ── Signer info ─────────────────────────────────────────────────────────────
  addText('SIGNER INFORMATION', 9, 'bold', '#444444');
  addText(`Full Name: ${ctx.signerName}`, 9);
  if (ctx.signerEmail) addText(`Email: ${ctx.signerEmail}`, 9);
  addText(`Signing Role: ${ctx.role === 'participant' ? 'Participant (signing for themselves)' : 'Parent / Legal Guardian'}`, 9);
  if (ctx.role === 'guardian') {
    addText(`Relationship to Minor(s): ${ctx.guardianRelationship ?? 'Not specified'}`, 9);
  }
  addText(`Participants Covered: ${ctx.participantsCovered.join(', ')}`, 9);
  y += 2;
  line();

  // ── Signed at ───────────────────────────────────────────────────────────────
  addText('SIGNATURE METADATA', 9, 'bold', '#444444');
  const signedDate = new Date(ctx.agreedAt);
  addText(`Date Signed: ${signedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 9);
  addText(`Time Signed (UTC): ${signedDate.toUTCString()}`, 9);
  if (ctx.ipAddress) addText(`IP Address: ${ctx.ipAddress}`, 9);
  if (ctx.userAgent) {
    const ua = doc.splitTextToSize(`User Agent: ${ctx.userAgent}`, contentW);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(ua, margin, y);
    y += (ua.length * 7 * 0.352) + 2;
  }
  y += 2;
  line();

  // ── Waiver text ─────────────────────────────────────────────────────────────
  checkPage(30);
  addText('WAIVER TEXT (AGREED TO IN FULL)', 9, 'bold', '#444444');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#333333');
  const waiverLines = doc.splitTextToSize(_WAIVER_TEXT, contentW);
  for (const wl of waiverLines) {
    checkPage(6);
    doc.text(wl, margin, y);
    y += 3.5;
  }
  y += 4;

  // ── Signature image ─────────────────────────────────────────────────────────
  checkPage(60);
  line();
  addText('DIGITAL SIGNATURE', 9, 'bold', '#444444');

  try {
    // signature_data_url is 'data:image/png;base64,...'
    doc.addImage(ctx.signatureDataUrl, 'PNG', margin, y, 90, 30);
    y += 34;
  } catch {
    addText('[Signature image could not be embedded]', 8, 'normal', '#cc0000');
  }

  // Signature line
  doc.setDrawColor(100, 100, 100);
  doc.line(margin, y, margin + 90, y);
  y += 4;
  addText(ctx.signerName, 8);
  y += 2;
  addText(`Signed digitally on ${signedDate.toLocaleDateString('en-US')}`, 8, 'normal', '#666666');

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#999999');
    doc.text(
      `Florida Mountain Bike Trail Guided Tours — Waiver Evidence Record — Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  return doc.output('datauristring');
}
