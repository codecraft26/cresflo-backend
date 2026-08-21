import { PDFParse } from "pdf-parse";

import { HttpError } from "../../advisor/errors.js";

const extractPdfText = async (buffer: Buffer) => {
  if (buffer.byteLength === 0) {
    throw new HttpError(400, "Uploaded PDF file is empty.");
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = result.text
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length < 20) {
      throw new HttpError(
        400,
        "Could not extract enough text from this PDF. It may be image-only and require OCR.",
      );
    }

    return text;
  } finally {
    await parser.destroy();
  }
};

export { extractPdfText };
