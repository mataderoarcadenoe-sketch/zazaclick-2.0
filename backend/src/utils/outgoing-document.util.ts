/** Validate locally supplied PDFs without fetching URLs or touching the WhatsApp engine. */
export function outgoingDocumentError(body: any): string | null {
  if (body?.mimetype !== 'application/pdf') return null;
  if (body.mediatype !== 'document' || typeof body.media !== 'string') return 'Declara el PDF como document y application/pdf.';
  if (/^https?:\/\//i.test(body.media)) return null; // The engine's SSRF validator owns URL media.
  const prefix = 'data:application/pdf;base64,';
  const data = body.media.startsWith(prefix) ? body.media.slice(prefix.length) : body.media;
  if (data.length > Math.ceil(8 * 1024 * 1024 / 3) * 4 || data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return 'PDF base64 inválido o mayor de 8 MiB.';
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length < 8 || bytes.length > 8 * 1024 * 1024 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-' ||
    !bytes.subarray(Math.max(0, bytes.length - 4096)).toString('latin1').includes('%%EOF')) return 'El PDF está incompleto o no es válido.';
  if (body.fileName !== undefined && (typeof body.fileName !== 'string' || body.fileName.length > 150 ||
    /[\x00-\x1f\x7f/\\]/.test(body.fileName))) return 'Nombre de archivo no válido.';
  return null;
}
