import { URL } from 'url';
import dns from 'dns';

/**
 * Verifica si una dirección IP pertenece a rangos privados o de loopback (RFC 1918, RFC 3927, Loopback, Link-Local)
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;

  // IPv4 Loopback (127.0.0.0/8) y 0.0.0.0
  if (ip.startsWith('127.') || ip === '0.0.0.0') return true;

  // IPv6 Loopback y link-local
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true;

  // AWS/GCP/Cloud Metadata (169.254.169.254) y Link-Local (169.254.0.0/16)
  if (ip.startsWith('169.254.')) return true;

  // RFC 1918: 10.0.0.0/8
  if (ip.startsWith('10.')) return true;

  // RFC 1918: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }

  // RFC 1918: 192.168.0.0/16
  if (ip.startsWith('192.168.')) return true;

  return false;
}

/**
 * Valida de forma estricta contra SSRF una URL provista por un cliente
 */
export async function validateSafeUrl(urlString: string): Promise<{ safe: boolean; error?: string }> {
  try {
    if (!urlString || typeof urlString !== 'string') {
      return { safe: false, error: 'URL no proporcionada o formato inválido.' };
    }

    const parsed = new URL(urlString);

    // 1. Protocolo estrictamente HTTP o HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Protocolo no permitido. Solo se aceptan URLs HTTP o HTTPS.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Bloqueo de hostnames reservados
    const blockedHosts = ['localhost', 'railway.internal', 'metadata.google.internal', 'instance-data'];
    if (blockedHosts.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
      return { safe: false, error: 'Acceso a host interno no permitido (SSRF Protection).' };
    }

    // 3. Si el hostname es una IP literal directa
    if (isPrivateIp(hostname)) {
      return { safe: false, error: 'Acceso a IP privada/local no permitido (SSRF Protection).' };
    }

    // 4. Resolución DNS asíncrona para prevenir DNS Rebinding a IPs privadas
    try {
      const lookupResult = await dns.promises.lookup(hostname, { all: true });
      for (const entry of lookupResult) {
        if (isPrivateIp(entry.address)) {
          return { safe: false, error: `El dominio resuelve a una dirección IP privada protegida (${entry.address}).` };
        }
      }
    } catch (dnsErr: any) {
      return { safe: false, error: `No se pudo resolver el dominio DNS: ${dnsErr.message}` };
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, error: `URL inválida o malformada: ${err.message}` };
  }
}

/**
 * Normaliza y sanitiza cadenas Base64 removiendo prefijos Data URI si existen
 */
export function normalizeBase64(mediaString: string): string {
  if (!mediaString || typeof mediaString !== 'string') return '';
  if (mediaString.startsWith('data:') && mediaString.includes(';base64,')) {
    return mediaString.split(';base64,')[1];
  }
  return mediaString.trim();
}
