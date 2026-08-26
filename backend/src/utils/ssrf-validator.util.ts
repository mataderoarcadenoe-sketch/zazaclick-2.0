import * as dns from 'dns';
import { URL } from 'url';

export interface SSRFValidationResult {
  isValid: boolean;
  reason?: string;
  resolvedIps?: string[];
  normalizedUrl?: string;
}

/**
 * Convierte una dirección IPv4 (string) a un número entero de 32 bits sin signo.
 * Retorna -1 si no es una IPv4 válida.
 */
function ipv4ToLong(ip: string): number {
  if (!ip || typeof ip !== 'string') return -1;
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;

  const nums = parts.map(p => {
    if (!/^\d+$/.test(p)) return -1;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255 ? n : -1;
  });

  if (nums.some(n => n === -1)) return -1;

  return (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0);
}

/**
 * Valida si una IPv4 pertenece a rangos reservados, privados, loopback o cloud metadata
 */
export function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToLong(ip);
  if (num === -1) return false; // No es una IPv4 válida, por lo que no es una IP privada

  // 0.0.0.0/8 (Broadcast / Current Network)
  if (((num & 0xFF000000) >>> 0) === 0x00000000) return true;

  // 127.0.0.0/8 (Loopback)
  if (((num & 0xFF000000) >>> 0) === 0x7F000000) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (((num & 0xFF000000) >>> 0) === 0x0A000000) return true;

  // 100.64.0.0/10 (Shared Address / CGNAT)
  if (((num & 0xFFC00000) >>> 0) === 0x64400000) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
  if (((num & 0xFFFF0000) >>> 0) === 0xA9FE0000) return true;

  // 172.16.0.0/12 (Private RFC 1918)
  if (((num & 0xFFF00000) >>> 0) === 0xAC100000) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (((num & 0xFFFF0000) >>> 0) === 0xC0A80000) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (((num & 0xFFFFFF00) >>> 0) === 0xC0000200) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (((num & 0xFFFFFF00) >>> 0) === 0xC6336400) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (((num & 0xFFFFFF00) >>> 0) === 0xCB007100) return true;

  // 224.0.0.0/4 (Multicast)
  if (((num & 0xF0000000) >>> 0) === 0xE0000000) return true;

  // 240.0.0.0/4 (Reserved)
  if (((num & 0xF0000000) >>> 0) === 0xF0000000) return true;

  return false;
}

/**
 * Valida si una IPv6 pertenece a rangos reservados, privados o loopback
 */
export function isPrivateIPv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string' || !ip.includes(':')) return false;
  const clean = ip.toLowerCase().replace(/[\[\]]/g, '');

  // ::1 (Loopback)
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;

  // :: (Unspecified)
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.128)
  if (clean.startsWith('::ffff:')) {
    const ipv4Part = clean.substring(7);
    return isPrivateIPv4(ipv4Part);
  }

  // fc00::/7 (Unique Local Address - ULA)
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true;

  // fe80::/10 (Link-Local)
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) return true;

  return false;
}

/**
 * Valida exhaustivamente una URL para prevenir Server-Side Request Forgery (SSRF)
 * Resuelve DNS y verifica que TODAS las direcciones IP sean públicas.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<SSRFValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, reason: 'URL requerida y debe ser un texto válido.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { isValid: false, reason: 'Formato de URL inválido.' };
  }

  // 1. Protocolo permitido únicamente http: o https:
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, reason: `Protocolo "${parsed.protocol}" no permitido. Use http: o https:.` };
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const cleanHostname = rawHostname.replace(/[\[\]]/g, '');

  // 2. Bloqueo de hostnames reservados conocidos
  const forbiddenHostnames = [
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    'instance-data',
    '169.254.169.254'
  ];

  if (forbiddenHostnames.includes(cleanHostname) || cleanHostname.endsWith('.internal') || cleanHostname.endsWith('.local')) {
    return {
      isValid: false,
      reason: `SSRF_BLOCKED: El hostname "${cleanHostname}" está prohibido por motivos de seguridad.`
    };
  }

  // 3. Si el hostname es una IP privada directa (IPv4 o IPv6)
  if (isPrivateIPv4(cleanHostname) || isPrivateIPv6(cleanHostname)) {
    return {
      isValid: false,
      reason: `SSRF_BLOCKED: La dirección IP "${cleanHostname}" es privada, loopback o metadata de nube.`
    };
  }

  // 4. Resolución DNS de todas las IPs asociadas al Hostname (Previene DNS Rebinding)
  try {
    const lookupResults = await dns.promises.lookup(cleanHostname, { all: true });

    if (!lookupResults || lookupResults.length === 0) {
      return { isValid: false, reason: `No se pudo resolver el hostname "${cleanHostname}".` };
    }

    const resolvedIps: string[] = [];

    for (const record of lookupResults) {
      resolvedIps.push(record.address);

      if (record.family === 4 && isPrivateIPv4(record.address)) {
        return {
          isValid: false,
          reason: `SSRF_BLOCKED: La resolución DNS de "${cleanHostname}" retornó la IP privada ${record.address}.`,
          resolvedIps
        };
      }

      if (record.family === 6 && isPrivateIPv6(record.address)) {
        return {
          isValid: false,
          reason: `SSRF_BLOCKED: La resolución DNS de "${cleanHostname}" retornó la IPv6 privada ${record.address}.`,
          resolvedIps
        };
      }
    }

    return {
      isValid: true,
      resolvedIps,
      normalizedUrl: parsed.toString()
    };
  } catch (dnsErr: any) {
    return {
      isValid: false,
      reason: `Error de resolución DNS para "${cleanHostname}": ${dnsErr.message}`
    };
  }
}
