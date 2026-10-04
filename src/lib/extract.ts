"use client";

/**
 * Text extraction from slide files, done in the browser so large decks never
 * have to be uploaded to the server — only the extracted text is sent to Claude.
 */

export interface ExtractedSlides {
  text: string;
  slideCount: number;
}

export const ACCEPTED_FILES = ".pdf,.pptx,.txt,.md";

export async function extractSlides(file: File): Promise<ExtractedSlides> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".pptx")) return extractPptx(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    return { text, slideCount: 1 };
  }
  if (name.endsWith(".ppt")) {
    throw new Error("Old .ppt files aren't supported. Open it in PowerPoint/Keynote/Google Slides and save as .pptx or PDF.");
  }
  throw new Error("Unsupported file type. Upload a PDF, PPTX or TXT file.");
}

async function extractPdf(file: File): Promise<ExtractedSlides> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = text.map((t, i) => `--- Slide ${i + 1} ---\n${t.trim()}`);
  return { text: pages.join("\n\n"), slideCount: totalPages };
}

async function extractPptx(file: File): Promise<ExtractedSlides> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const parser = new DOMParser();
  const slides: string[] = [];

  for (const [i, path] of slidePaths.entries()) {
    const xml = await zip.file(path)!.async("string");
    let block = `--- Slide ${i + 1} ---\n${paragraphs(parser, xml)}`;

    // Speaker notes often hold the most useful explanations.
    const relsPath = path.replace("slides/", "slides/_rels/") + ".rels";
    const rels = await zip.file(relsPath)?.async("string");
    const notesTarget = rels?.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/)?.[1];
    if (notesTarget) {
      const notesXml = await zip.file(`ppt/notesSlides/${notesTarget}`)?.async("string");
      const notes = notesXml ? paragraphs(parser, notesXml).replace(/^\d+$/gm, "").trim() : "";
      if (notes) block += `\n[Speaker notes]\n${notes}`;
    }
    slides.push(block);
  }

  return { text: slides.join("\n\n"), slideCount: slidePaths.length };
}

function slideNumber(path: string): number {
  return Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0);
}

/** Collect the text runs of each DrawingML paragraph (<a:p>) as one line. */
function paragraphs(parser: DOMParser, xml: string): string {
  const doc = parser.parseFromString(xml, "application/xml");
  const lines: string[] = [];
  for (const p of Array.from(doc.getElementsByTagNameNS("*", "p"))) {
    const line = Array.from(p.getElementsByTagNameNS("*", "t"))
      .map((t) => t.textContent ?? "")
      .join("")
      .trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}
