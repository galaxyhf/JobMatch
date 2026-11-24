import { PDFParse } from "pdf-parse";
import { extractRawText } from "mammoth";
import { fromBuffer } from "yauzl";
import { HttpError } from "../http";

export const maxUploadBytes = 4 * 1024 * 1024;
const expandedLimit = 16 * 1024 * 1024;
const pdfPageLimit = 40;
let activeParsers = 0;

const invalidFile = () => new HttpError(422, "INVALID_FILE", "O arquivo está corrompido, protegido ou fora do formato PDF/DOCX.");

function checkDocx(buffer: Buffer) {
  return new Promise<void>((resolve, reject) => {
    fromBuffer(buffer, {lazyEntries: true, validateEntrySizes: true}, (error, zip) => {
      if (error || !zip) {
        reject(invalidFile());
        return;
      }
      const entries = new Set<string>();
      let expanded = 0;
      function fail() {
        reject(invalidFile());
        zip.close();
      }
      zip.once("error", fail);
      zip.on("entry", entry => {
        expanded += entry.uncompressedSize;
        const invalid = entry.isEncrypted() || entries.has(entry.fileName) || expanded > expandedLimit ||
          zip.entryCount > 2048 || /(?:^|\/)(?:vbaproject\.bin|embeddings|activex)(?:\/|$)/i.test(entry.fileName);
        if (invalid) {
          fail();
          return;
        }
        entries.add(entry.fileName);
        if (entry.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail();
            return;
          }
          stream.once("error", fail);
          stream.once("end", () => zip.readEntry());
          stream.resume();
        });
      });
      zip.once("end", () => {
        if (entries.has("[Content_Types].xml") && entries.has("word/document.xml")) resolve();
        else fail();
      });
      zip.readEntry();
    });
  });
}

async function extractPdf(data: Uint8Array) {
  const parser = new PDFParse({data, isEvalSupported:false, useSystemFonts:false, stopAtErrors:true});
  try {
    const info = await parser.getInfo();
    if (info.total > pdfPageLimit) {
      throw new HttpError(422, "PAGE_LIMIT", `Envie um PDF com até ${pdfPageLimit} páginas.`);
    }
    const result = await parser.getText({pageJoiner: "\n\n", cellSeparator: " ", lineEnforce:true});
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractResume(file: File) {
  if (file.size > maxUploadBytes) throw new HttpError(413, "TOO_LARGE", "Envie um arquivo de até 4 MB.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if ((extension !== "pdf" && extension !== "docx") || file.size < 8) {
    throw new HttpError(415, "FORMAT", "Selecione um arquivo PDF ou DOCX válido.");
  }
  if (activeParsers >= 2) throw new HttpError(429, "BUSY", "O leitor está ocupado. Tente novamente em alguns segundos.", 5);
  activeParsers++;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const buffer = Buffer.from(data.buffer);
    let extracted: string;
    if (extension === "pdf") {
      if (!/^%PDF-\d\.\d/.test(buffer.subarray(0, 8).toString("ascii"))) throw invalidFile();
      extracted = await extractPdf(data);
    } else {
      if (buffer.readUInt32LE(0) !== 0x04034b50) throw invalidFile();
      await checkDocx(buffer);
      extracted = (await extractRawText({buffer})).value;
    }
    const clean = extracted.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
    if ((clean.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 12) {
      throw new HttpError(422, "NO_TEXT", "O arquivo não tem texto selecionável suficiente. Use um DOCX ou um PDF exportado de um editor de texto.");
    }
    if (clean.length > 160_000) throw new HttpError(422, "TEXT_LIMIT", "O arquivo contém texto demais para um currículo.");
    return clean;
  } catch (error) {
    throw error instanceof HttpError ? error : invalidFile();
  } finally {
    activeParsers--;
  }
}
