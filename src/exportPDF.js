import { jsPDF } from 'jspdf'

const GREEN  = [21, 128, 61]
const DARK   = [15, 23, 42]
const GRAY   = [100, 116, 139]
const LGRAY  = [241, 245, 249]
const WHITE  = [255, 255, 255]

const DISEASE_COLORS = {
  'Cultivo Sano':    [21, 128, 61],
  'Tizón del Maíz':  [194, 65, 12],
  'Roya':            [180, 83, 9],
  'Mancha Blanca':   [185, 28, 28],
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, maxWidth)
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

export async function exportAnalisisPDF({ diseaseLabel, affectedPercent, risk, fecha, originalImg, xaiImg, recommendations }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 14
  let y = 0

  // ── Header bar ─────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, W, 22, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text('AgroScan', margin, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Reporte de Análisis de Cultivo · UAV · IA', margin + 30, 13)

  const dateStr = fecha
    ? new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('es-ES')
  doc.text(dateStr, W - margin, 13, { align: 'right' })

  y = 30

  // ── Diagnosis card ─────────────────────────────────────────────────
  const dColor = DISEASE_COLORS[diseaseLabel] ?? DARK
  doc.setFillColor(...LGRAY)
  doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, 'F')

  doc.setFillColor(...dColor)
  doc.roundedRect(margin, y, 4, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('DIAGNÓSTICO', margin + 8, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...dColor)
  doc.text(diseaseLabel ?? '—', margin + 8, y + 16)

  // Affected % circle area (right side)
  const cx = W - margin - 20
  const cy = y + 14
  doc.setFillColor(...WHITE)
  doc.circle(cx, cy, 12, 'F')
  doc.setFillColor(...dColor)
  doc.setLineWidth(1.5)
  doc.circle(cx, cy, 12, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...dColor)
  doc.text(`${Number(affectedPercent ?? 0).toFixed(1)}%`, cx, cy + 1.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Área afect.', cx, cy + 7, { align: 'center' })

  // Risk badge
  const riskColors = { Alto: [185, 28, 28], Medio: [180, 83, 9], Bajo: [21, 128, 61] }
  const rColor = riskColors[risk] ?? riskColors.Bajo
  doc.setFillColor(...rColor)
  doc.roundedRect(W - margin - 60, y + 19, 28, 6, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...WHITE)
  doc.text(`Riesgo ${risk ?? '—'}`, W - margin - 60 + 14, y + 23.5, { align: 'center' })

  y += 34

  // ── Images ─────────────────────────────────────────────────────────
  const imgW = (W - margin * 2 - 6) / 2
  const imgH = 55

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('IMAGEN ORIGINAL', margin, y + 4)
  doc.text('MAPA GRAD-CAM XAI', margin + imgW + 6, y + 4)

  y += 7

  doc.setFillColor(...LGRAY)
  doc.roundedRect(margin, y, imgW, imgH, 2, 2, 'F')
  doc.roundedRect(margin + imgW + 6, y, imgW, imgH, 2, 2, 'F')

  if (originalImg) {
    try {
      doc.addImage(originalImg, 'JPEG', margin, y, imgW, imgH, undefined, 'FAST')
    } catch { /* ignore invalid image */ }
  }

  if (xaiImg) {
    try {
      const xaiSrc = xaiImg.startsWith('data:') ? xaiImg : `data:image/png;base64,${xaiImg}`
      doc.addImage(xaiSrc, 'PNG', margin + imgW + 6, y, imgW, imgH, undefined, 'FAST')
    } catch { /* ignore */ }
  }

  y += imgH + 10

  // ── Recommendations ────────────────────────────────────────────────
  if (recommendations && recommendations.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text('RECOMENDACIONES AGRONÓMICAS', margin, y)

    doc.setFillColor(...GREEN)
    doc.rect(margin, y + 2, W - margin * 2, 0.5, 'F')

    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...DARK)

    recommendations.forEach((rec, i) => {
      const label = typeof rec === 'object' ? rec.body : rec
      const title = typeof rec === 'object' ? rec.title : null

      doc.setFillColor(240, 253, 244)
      doc.roundedRect(margin, y - 1, W - margin * 2, title ? 12 : 9, 1.5, 1.5, 'F')

      doc.setFillColor(...GREEN)
      doc.circle(margin + 4, y + 3.5, 2.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...WHITE)
      doc.text(`${i + 1}`, margin + 4, y + 4.5, { align: 'center' })

      if (title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...DARK)
        doc.text(title, margin + 10, y + 4)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...GRAY)
        y = addWrappedText(doc, label, margin + 10, y + 8.5, W - margin * 2 - 12, 4)
        y += 3
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...DARK)
        y = addWrappedText(doc, label, margin + 10, y + 4.5, W - margin * 2 - 12, 4.5)
        y += 3
      }
    })
  }

  // ── Footer ─────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFillColor(...LGRAY)
  doc.rect(0, pageH - 12, W, 12, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('AgroScan · Detección de Enfermedades en Maíz · UAV · IA · Grad-CAM XAI', margin, pageH - 5)
  doc.text('Generado automáticamente — no reemplaza diagnóstico agronómico profesional', W - margin, pageH - 5, { align: 'right' })

  const filename = `agroscan_reporte_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
