import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { HttpError } from "../utils/http.js";

const SIGNATURES = {
  pdf: (buf) => buf.subarray(0, 4).toString("latin1") === "%PDF",
  docx: (buf) => buf[0] === 0x50 && buf[1] === 0x4b,
  doc: (buf) => buf.subarray(0, 4).toString("hex") === "d0cf11e0"
};

export function detectResumeType(file) {
  const ext = file.originalname.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx", "doc"].includes(ext)) throw new HttpError(400, "Only PDF, DOC, and DOCX resumes are supported");
  // Validate magic bytes so a renamed file can't slip through.
  if (!SIGNATURES[ext](file.buffer)) throw new HttpError(400, `File content does not look like a valid .${ext} document`);
  return ext;
}

// Legacy .doc is a binary format; pull out runs of readable text as a best effort.
function extractDocText(buffer) {
  const text = buffer.toString("latin1").match(/[\x20-\x7E\r\n\t]{4,}/g) || [];
  return text.join(" ");
}

export async function parseResume(file) {
  const type = detectResumeType(file);
  let text = "";
  if (type === "pdf") text = (await pdfParse(file.buffer)).text;
  else if (type === "docx") text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
  else text = extractDocText(file.buffer);

  text = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 40) throw new HttpError(422, "Could not read text from this resume. Try exporting it as a text-based PDF.");
  return text.slice(0, 30000);
}
