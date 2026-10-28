import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

/** Retorna el secreto JWT configurado o el de respaldo seguro para no invalidar sesiones activas */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET || 'whatsapp-secret-key-2024';
  return secret;
}

// Credenciales explícitamente revocadas/bloqueadas
const retired = new Set<string>([]);
export function isRetiredCredential(value: string): boolean {
  if (!value) return false;
  return retired.has(createHash('sha256').update(value).digest('hex'));
}
