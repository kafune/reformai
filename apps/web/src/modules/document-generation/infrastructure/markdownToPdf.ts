import PDFDocument from "pdfkit"

/**
 * Converte o markdown simples dos relatórios (títulos #/##/###, parágrafos,
 * listas com -, regra horizontal ---, ênfase **negrito**) em um PDF A4.
 * Sem browser headless — usa pdfkit com as fontes padrão (Helvetica).
 */
export function markdownToPdf(markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const lines = markdown.replace(/\r\n/g, "\n").split("\n")

    for (const raw of lines) {
      const line = raw.trimEnd()

      if (line.trim() === "") {
        doc.moveDown(0.5)
        continue
      }
      if (/^---+$/.test(line.trim())) {
        const y = doc.y + 2
        doc
          .moveTo(doc.page.margins.left, y)
          .lineTo(doc.page.width - doc.page.margins.right, y)
          .strokeColor("#cccccc")
          .stroke()
        doc.moveDown(0.6)
        continue
      }

      const h = /^(#{1,3})\s+(.*)$/.exec(line)
      if (h) {
        const level = h[1]!.length
        const size = level === 1 ? 20 : level === 2 ? 15 : 12.5
        doc.moveDown(level === 1 ? 0.2 : 0.4)
        doc.font("Helvetica-Bold").fontSize(size).fillColor("#1a1a1a")
        doc.text(stripInline(h[2]!))
        doc.moveDown(0.3)
        continue
      }

      const bullet = /^[-*]\s+(.*)$/.exec(line.trim())
      if (bullet) {
        doc.font("Helvetica").fontSize(10.5).fillColor("#222222")
        renderInline(doc, `•  ${bullet[1]!}`, { indent: 14 })
        continue
      }

      doc.font("Helvetica").fontSize(10.5).fillColor("#222222")
      renderInline(doc, line)
    }

    doc.end()
  })
}

/** Remove marcadores inline (negrito) deixando só o texto. */
function stripInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1")
}

/**
 * Renderiza um parágrafo com suporte a **negrito** intercalado, usando
 * texto contínuo do pdfkit.
 */
function renderInline(doc: PDFKit.PDFDocument, text: string, opts: { indent?: number } = {}): void {
  const segments = text.split(/(\*\*.+?\*\*)/g).filter((s) => s.length > 0)
  const x = doc.page.margins.left + (opts.indent ?? 0)
  let first = true
  for (const seg of segments) {
    const bold = seg.startsWith("**") && seg.endsWith("**")
    const content = bold ? seg.slice(2, -2) : seg
    doc.font(bold ? "Helvetica-Bold" : "Helvetica")
    doc.text(content.replace(/`/g, ""), first ? x : undefined, undefined, {
      continued: seg !== segments[segments.length - 1],
    })
    first = false
  }
  doc.moveDown(0.35)
}
