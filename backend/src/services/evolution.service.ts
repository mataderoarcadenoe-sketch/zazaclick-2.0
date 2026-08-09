import axios from 'axios';
import * as dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import redis from '../config/redis';

dotenv.config();

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

if (!EVOLUTION_URL || !EVOLUTION_KEY) {
  console.warn('⚠️ [EvolutionService] EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados.');
}

const api = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'apikey': EVOLUTION_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 100 }),
});

export class EvolutionService {
  private static lidCache = new Map<string, string>();
  private static lastReadTimestamps = new Map<string, number>();
  private static contactsCache = new Map<string, Map<string, string>>(); // Mapea instanceName -> (JID -> name)
  private static lastContactsFetch = new Map<string, number>(); // Mapea instanceName -> timestamp in ms

  /**
   * Extrae y formatea el mensaje de error de una excepción de Axios
   */
  private static parseError(err: any): string {
    try {
      if (err.response) {
        const data = err.response.data;
        if (data) {
          if (typeof data === 'string') {
            return data;
          }
          if (typeof data === 'object') {
            // NestJS/Evolution API anidan a veces el error en data.response
            const nested = data.response;
            let message = null;
            if (nested && typeof nested === 'object') {
              message = nested.message || nested.error || nested.err;
            }
            if (!message) {
              message = data.message || data.error || data.err;
            }

            if (message) {
              if (Array.isArray(message)) {
                return message.join(', ');
              }
              if (typeof message === 'object') {
                return JSON.stringify(message);
              }
              return String(message);
            }
          }
        }
        return `Error ${err.response.status}: ${err.response.statusText || 'Petición incorrecta'}`;
      }
      if (err.request) {
        return 'No se recibió respuesta del servidor de Evolution API. Verifica que esté en línea.';
      }
      return err.message || 'Error desconocido';
    } catch {
      return err?.message || 'Error desconocido al procesar la respuesta';
    }
  }

  public static async createInstance(instanceName: string): Promise<{ success: boolean; instance?: any; error?: string; status?: number }> {
    try {
      const BACKEND_URL = process.env.BACKEND_URL || 'https://zaza-click-20-production.up.railway.app';
      const webhookUrl = `${BACKEND_URL}/api/webhooks/whatsapp`;
        
      console.log(`🔌 [EvolutionService] Registrando webhook en creación: ${webhookUrl}`);

      // Intentar eliminar la instancia en Evolution por si existe con el mismo nombre (limpieza previa)
      try {
        await api.delete(`/instance/delete/${instanceName}`);
        console.log(`🧹 [EvolutionService] Instancia previa ${instanceName} eliminada en Evolution antes de crear.`);
      } catch {
        // Ignorar error si la instancia no existia en Evolution
      }

      const response = await api.post('/instance/create', {
        instanceName,
        token: this.generateRandomToken(),
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: true,
          webhookByEvents: true,
          events: [
            'MESSAGES_UPSERT',
            'CHATS_UPDATE',
            'MESSAGES_UPDATE',
            'CONTACTS_UPSERT',
            'CONTACTS_UPDATE',
            'PRESENCE_UPDATE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED'
          ]
        },
        settings: {
          alwaysOnline: true,
          rejectCall: false,
          groupsIgnore: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false
        }
      });

      if (response.data?.instance) {
        const token = response.data.hash || response.data.instance.token || response.data.instance.apikey;
        return {
          success: true,
          instance: {
            ...response.data.instance,
            token
          }
        };
      }
      return { success: false, error: 'Respuesta inválida de Evolution API', status: 502 };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      const status = err.response?.status || 500;
      console.error(`[EvolutionService] Error creando instancia ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status };
    }
  }

  /**
   * Obtener el estado actual de la conexión (connected, disconnected, etc.)
   */
  public static async getConnectionState(instanceName: string): Promise<string> {
    try {
      const response = await api.get(`/instance/connectionState/${instanceName}`);
      return response.data?.instance?.state || 'disconnected';
    } catch (err: any) {
      // Si devuelve 404, asumimos que no existe o está desconectada
      return 'disconnected';
    }
  }

  /**
   * Obtener el código QR en Base64 o JSON para escanear
   */
  public static async getQRCode(instanceName: string): Promise<{ success: boolean; qrcode?: string; error?: string }> {
    try {
      const response = await api.get(`/instance/connect/${instanceName}`);
      if (response.data?.base64) {
        return { success: true, qrcode: response.data.base64 };
      }
      return { success: false, error: 'No se generó el código QR' };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Cerrar sesión (Logout) del número sin eliminar la instancia
   */
  public static async logout(instanceName: string): Promise<boolean> {
    try {
      const response = await api.delete(`/instance/logout/${instanceName}`);
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Eliminar por completo la instancia de Evolution API
   */
  public static async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await api.delete(`/instance/delete/${instanceName}`);
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Enviar un mensaje de texto a través de una instancia específica
   */
  public static async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    try {
      let targetNumber = number;
      if (!number.includes('@')) {
        let cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }
      const response = await api.post(`/message/sendText/${instanceName}`, {
        number: targetNumber,
        text: text,
      });
      return { success: response.status === 200 || response.status === 201 };
    } catch (err: any) {
      console.error(`[EvolutionService] Error enviando mensaje a ${number}:`, err.message, err.response?.data);
      return { 
        success: false, 
        error: err.message, 
        details: err.response?.data 
      };
    }
  }

  /**
   * Enviar un mensaje multimedia (imagen, video, documento, audio) a través de una instancia
   */
  public static async sendMediaMessage(
    instanceName: string,
    number: string,
    media: string,
    mediatype: 'image' | 'video' | 'document' | 'audio',
    mimetype: string,
    caption?: string,
    fileName?: string
  ): Promise<any> {
    try {
      let targetNumber = number;
      if (!number.includes('@')) {
        let cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      let finalMediatype = mediatype;
      const isGif = mimetype === 'image/gif' || (fileName && fileName.toLowerCase().endsWith('.gif')) || (media && media.toLowerCase().includes('.gif'));

      let finalMedia = media;
      // Si media es una URL, descargarla y convertirla a base64 para evitar bloqueos de Cloudflare
      if (media.startsWith('http')) {
        try {
          console.log(`[EvolutionService] Descargando media desde URL para enviar como Base64: ${media}`);
          const downloadRes = await axios.get(media, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }) // Evitar problemas con certificados SSL auto-firmados
          });
          const base64Data = Buffer.from(downloadRes.data, 'binary').toString('base64');
          finalMedia = base64Data; // Evolution API requiere el base64 puro (sin el prefijo 'data:...;base64,')
        } catch (downloadErr: any) {
          console.warn(`[EvolutionService] No se pudo descargar la media en el backend, enviando URL original:`, downloadErr.message);
          finalMedia = media;
        }
      }

      const payload: any = {
        number: targetNumber,
        mediatype: isGif ? 'video' : finalMediatype,
        mimetype,
        media: finalMedia,
      };

      if (isGif) {
        payload.gifPlayback = true;
      }

      if (caption) {
        payload.caption = caption;
      }
      if (fileName) {
        payload.fileName = fileName;
      }

      const response = await api.post(`/message/sendMedia/${instanceName}`, payload);
      return { success: response.status === 200 || response.status === 201 };
    } catch (err: any) {
      console.error(`[EvolutionService] Error enviando media (${mediatype}) a ${number}:`, err.message, err.response?.data);
      return {
        success: false,
        error: err.message,
        details: err.response?.data
      };
    }
  }

  /**
   * Obtener el estado actual de la licencia de Evolution API
   */
  public static async getLicenseStatus(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.get('/license/status');
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error obteniendo estado de licencia:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generar la URL de registro de licencia
   */
  public static async registerLicense(redirectUri: string): Promise<{ success: boolean; registerUrl?: string; error?: string }> {
    try {
      const response = await api.get(`/license/register?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (response.data?.register_url || response.data?.url) {
        return { success: true, registerUrl: response.data.register_url || response.data.url };
      }
      return { success: false, error: 'No se generó la URL de registro.' };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error registrando licencia:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Activar la licencia usando el código de callback
   */
  public static async activateLicense(code: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.get(`/license/activate?code=${code}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error activando licencia con código:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener chats activos de la instancia
   */
  public static async getChats(instanceName: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      // Disparar sincronización de contactos de fondo sin bloquear el hilo principal (0ms adicionales de carga)
      this.syncContactsCache(instanceName).catch(err => {
        console.warn('[EvolutionService] Sincronización en background falló:', err.message);
      });

      const response = await api.post(`/chat/findChats/${instanceName}`, {});
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo chats para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Sincronizar en segundo plano la agenda de contactos de WhatsApp en una caché interna
   */
  public static async syncContactsCache(instanceName: string): Promise<void> {
    try {
      const now = Date.now();
      const lastFetch = this.lastContactsFetch.get(instanceName) || 0;
      
      // Sincronizar solo si pasaron más de 5 minutos desde el último fetch
      if (now - lastFetch < 300000 && this.contactsCache.has(instanceName)) {
        return;
      }

      console.log(`👤 [EvolutionService] Sincronizando caché de contactos para ${instanceName}...`);
      const contacts = await this.getRawContacts(instanceName);
      
      if (Array.isArray(contacts)) {
        const instanceMap = this.contactsCache.get(instanceName) || new Map<string, string>();
        for (const contact of contacts) {
          if (contact && contact.remoteJid) {
            const name = contact.name || contact.pushName || contact.shortName;
            if (name) {
              let cleanJid = contact.remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
              instanceMap.set(cleanJid, name);
            }
          }
        }
        this.contactsCache.set(instanceName, instanceMap);
        this.lastContactsFetch.set(instanceName, now);
        console.log(`👤 [EvolutionService] Sincronizados ${instanceMap.size} contactos para la instancia ${instanceName}`);
      }
    } catch (err: any) {
      console.warn(`[EvolutionService] No se pudo sincronizar la agenda de contactos para ${instanceName}:`, err.message);
    }
  }

  /**
   * Obtener mensajes de un chat específico
   */
  public static async getChatMessages(instanceName: string, remoteJid: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.post(`/chat/findMessages/${instanceName}`, {
        where: {
          key: {
            remoteJid: remoteJid
          }
        },
        limit: 100
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo mensajes para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Obtener el Base64 de un archivo multimedia
   */
  public static async getMediaMessageBase64(instanceName: string, messageKey: any, messageContent: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: {
          key: messageKey,
          message: messageContent
        }
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo base64 de multimedia:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generador de tokens aleatorios para asegurar las instancias de los clientes
   */
  private static generateRandomToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Resuelve un LID de WhatsApp (@lid) a su número de teléfono real (@s.whatsapp.net) llamando a fetchProfile
   */
  public static async resolveLidToPhone(instanceName: string, lid: string): Promise<string> {
    try {
      if (this.lidCache.has(lid)) {
        return this.lidCache.get(lid)!;
      }

      console.log(`[EvolutionService] Resolviendo LID ${lid} a teléfono real mediante API...`);
      const response = await api.post(`/chat/fetchProfile/${instanceName}`, {
        number: lid
      });

      const resolvedJid = response.data?.jid || response.data?.remoteJid || response.data?.id;
      if (resolvedJid && resolvedJid.endsWith('@s.whatsapp.net')) {
        this.lidCache.set(lid, resolvedJid);
        console.log(`[EvolutionService] LID ${lid} resuelto exitosamente a ${resolvedJid}`);
        return resolvedJid;
      }
      
      // Si la API respondió pero no trajo un JID válido de teléfono, guardamos el LID en caché apuntando a sí mismo (evita reintentos infinitos)
      this.lidCache.set(lid, lid);
      return lid;
    } catch (err: any) {
      console.warn(`[EvolutionService] No se pudo resolver el LID ${lid}:`, err.message);
      // Guardar en caché el error para evitar reintentar en el próximo polling
      this.lidCache.set(lid, lid);
      return lid;
    }
  }


  /**
   * Unificar chats @lid con sus números reales para evitar conversaciones duplicadas
   */
  public static async mergeChats(instanceName: string, chats: any[], dbUnreadCounts?: Map<string, number>): Promise<any[]> {
    const mergedMap = new Map<string, any>();

    // 1. Identificar LIDs únicos que necesitan resolución en esta petición
    const lidsToResolve = new Set<string>();
    for (const chat of chats) {
      if (chat && chat.remoteJid && chat.remoteJid.endsWith('@lid')) {
        const hasAlt = (chat.remoteJidAlt && chat.remoteJidAlt.endsWith('@s.whatsapp.net')) || 
                       (chat.jidAlt && chat.jidAlt.endsWith('@s.whatsapp.net')) ||
                       (chat.lastMessage?.key?.remoteJidAlt && chat.lastMessage.key.remoteJidAlt.endsWith('@s.whatsapp.net')) ||
                       (chat.lastMessage?.remoteJidAlt && chat.lastMessage.remoteJidAlt.endsWith('@s.whatsapp.net')) ||
                       (chat.contact?.remoteJidAlt && chat.contact.remoteJidAlt.endsWith('@s.whatsapp.net')) ||
                       (chat.contact?.jidAlt && chat.contact.jidAlt.endsWith('@s.whatsapp.net')) ||
                       (chat.contact?.id && chat.contact.id.endsWith('@s.whatsapp.net')) ||
                       (chat.contact?.remoteJid && chat.contact.remoteJid.endsWith('@s.whatsapp.net'));
        
        if (!hasAlt && !this.lidCache.has(chat.remoteJid)) {
          lidsToResolve.add(chat.remoteJid);
        }
      }
    }

    // 2. Resolver todos los LIDs detectados en paralelo para evitar retrasar el hilo
    if (lidsToResolve.size > 0) {
      console.log(`[EvolutionService] Resolviendo ${lidsToResolve.size} LIDs en paralelo para carga inicial...`);
      await Promise.all(
        Array.from(lidsToResolve).map(lid => 
          this.resolveLidToPhone(instanceName, lid).catch(err => 
            console.warn(`[EvolutionService] Error resolviendo LID ${lid} en paralelo:`, err.message)
          )
        )
      );
    }

    for (const chat of chats) {
      if (!chat || !chat.remoteJid) continue;
      if (chat.remoteJid === 'status@broadcast') continue;

      let realJid = chat.remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');

      // Si es un @lid, intentamos obtener su número real de múltiples lugares posibles
      if (realJid.endsWith('@lid')) {
        if (chat.remoteJidAlt && chat.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.remoteJidAlt;
        } else if (chat.jidAlt && chat.jidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.jidAlt;
        } else if (chat.lastMessage?.key?.remoteJidAlt && chat.lastMessage.key.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.lastMessage.key.remoteJidAlt;
        } else if (chat.lastMessage?.remoteJidAlt && chat.lastMessage.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.lastMessage.remoteJidAlt;
        } else if (chat.contact?.remoteJidAlt && chat.contact.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.remoteJidAlt;
        } else if (chat.contact?.jidAlt && chat.contact.jidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.jidAlt;
        } else if (chat.contact?.id && chat.contact.id.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.id;
        } else if (chat.contact?.remoteJid && chat.contact.remoteJid.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.remoteJid;
        } else if (this.lidCache.has(realJid)) {
          realJid = this.lidCache.get(realJid)!;
        } else {
          // Lanzar resolución en segundo plano sin await para no colgar la UI del usuario
          const currentLid = realJid;
          this.resolveLidToPhone(instanceName, currentLid).catch(err => {
            console.warn(`[EvolutionService] Error en resolución background de LID ${currentLid}:`, err.message);
          });
        }
      }
      
      realJid = realJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');

      // Obtener el contador de mensajes no leídos tolerando la base de datos de Zaza o la API de Evolution
      const chatUnread = (chat.unreadMessages !== undefined && chat.unreadMessages !== null) 
        ? chat.unreadMessages 
        : (chat.unreadCount !== undefined && chat.unreadCount !== null)
        ? chat.unreadCount
        : (chat.unread_messages !== undefined && chat.unread_messages !== null)
        ? chat.unread_messages
        : chat.unread;
      const chatUnreadNum = Number(chatUnread) || 0;

      let unreadCountNum = chatUnreadNum;
      if (dbUnreadCounts) {
        const countReal = dbUnreadCounts.get(realJid) || 0;
        const countOrig = dbUnreadCounts.get(chat.remoteJid) || 0;
        unreadCountNum = Math.max(unreadCountNum, countReal, countOrig);
      }

      // Aplicar el override del contador de mensajes no leídos si el último mensaje es anterior al timestamp de lectura marcado
      const cacheKeyReal = `${instanceName}:${realJid}`;
      const cacheKeyOrig = `${instanceName}:${chat.remoteJid}`;
      const lastReadReal = this.lastReadTimestamps.get(cacheKeyReal);
      const lastReadOrig = this.lastReadTimestamps.get(cacheKeyOrig);
      
      const lastRead = lastReadReal !== undefined ? lastReadReal : lastReadOrig;
      
      let finalUnreadCount = unreadCountNum;
      if (lastRead !== undefined) {
        let lastMsgTimestamp = chat.lastMessage?.messageTimestamp || 0;
        if (lastMsgTimestamp > 0 && lastMsgTimestamp < 10000000000) {
          // Convertir segundos a milisegundos
          lastMsgTimestamp = lastMsgTimestamp * 1000;
        }

        if (lastMsgTimestamp <= lastRead) {
          finalUnreadCount = 0;
        } else {
          // Ha llegado un mensaje nuevo después de marcar como leído, borrar caché
          this.lastReadTimestamps.delete(cacheKeyReal);
          this.lastReadTimestamps.delete(cacheKeyOrig);
        }
      }

      // Intentar recuperar el nombre del contacto: 1) Redis (agenda sync), 2) caché en memoria, 3) nombre de la agenda en el chat, 4) pushName del chat
      let displayName = chat.name || chat.pushName;
      
      // Buscar en Redis (nombres de agenda sincronizados via CONTACTS_UPSERT)
      const agendaName = await EvolutionService.getContactName(instanceName, realJid);
      if (agendaName) {
        displayName = agendaName;
      } else {
        // Fallback a caché en memoria (findContacts)
        const instanceMap = this.contactsCache.get(instanceName);
        if (instanceMap) {
          displayName = instanceMap.get(realJid) || instanceMap.get(chat.remoteJid) || displayName;
        }
      }
      
      // Fallback a lastMessage.pushName si no hay nombre de agenda y el último mensaje fue recibido de ellos
      if (!displayName && chat.lastMessage && chat.lastMessage.key && chat.lastMessage.key.fromMe === false) {
        displayName = chat.lastMessage.pushName;
      }

      // Para originalJid: preferir siempre un JID que sea especial (ej. LID o JID con puerto :0)
      let finalOriginalJid = chat.remoteJid;

      const existing = mergedMap.get(realJid);
      
      if (!existing) {
        // Primer vez que vemos este JID real
        const newChat = { 
          ...chat, 
          remoteJid: realJid, 
          originalJid: finalOriginalJid,
          pushName: displayName || chat.pushName || null,
          unreadCount: finalUnreadCount
        };
        mergedMap.set(realJid, newChat);
      } else {
        // Fusionar si ya existía
        const currentTs = chat.lastMessage?.messageTimestamp || 0;
        const existingTs = existing.lastMessage?.messageTimestamp || 0;
        
        // Conservar el originalJid especial si alguno de los dos lo es (ej: LID o que contenga ':')
        let resolvedOriginalJid = existing.originalJid || existing.remoteJid;
        if (finalOriginalJid && (finalOriginalJid.endsWith('@lid') || finalOriginalJid.includes(':') || !resolvedOriginalJid.endsWith('@lid'))) {
          // Si el nuevo es un LID o tiene puerto, o el anterior no es un LID (preferir LID sobre todo)
          if (finalOriginalJid.endsWith('@lid') || !resolvedOriginalJid.endsWith('@lid')) {
            resolvedOriginalJid = finalOriginalJid;
          }
        }

        const totalUnread = Math.max(Number(existing.unreadCount) || 0, finalUnreadCount);
        
        if (currentTs > existingTs) {
          const merged = { 
            ...chat, 
            remoteJid: realJid,
            originalJid: resolvedOriginalJid,
            profilePicUrl: chat.profilePicUrl || existing.profilePicUrl,
            pushName: displayName || chat.pushName || existing.pushName || null,
            unreadCount: totalUnread
          };
          mergedMap.set(realJid, merged);
        } else {
          existing.profilePicUrl = existing.profilePicUrl || chat.profilePicUrl;
          existing.pushName = displayName || existing.pushName || chat.pushName || null;
          existing.unreadCount = totalUnread;
          existing.originalJid = resolvedOriginalJid;
          mergedMap.set(realJid, existing);
        }
      }
    }

    // Ordenar por el timestamp del último mensaje de forma descendente
    return Array.from(mergedMap.values()).sort((a, b) => {
      const tsA = a.lastMessage?.messageTimestamp || 0;
      const tsB = b.lastMessage?.messageTimestamp || 0;
      return tsB - tsA;
    });
  }

  /**
   * Registrar manualmente un timestamp de lectura para un JID (tanto original como unificado)
   */
  public static recordReadTimestamp(instanceName: string, remoteJid: string, phoneJid?: string): void {
    let unifiedJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
    if (unifiedJid.endsWith('@lid') && this.lidCache.has(unifiedJid)) {
      unifiedJid = this.lidCache.get(unifiedJid)!;
    }

    const nowInMs = Date.now() + 2000; // Guardar en milisegundos con 2 segundos de margen
    this.lastReadTimestamps.set(`${instanceName}:${remoteJid}`, nowInMs);
    this.lastReadTimestamps.set(`${instanceName}:${unifiedJid}`, nowInMs);
    if (phoneJid) {
      this.lastReadTimestamps.set(`${instanceName}:${phoneJid}`, nowInMs);
    }
    
    // Resetear contadores de no leídos en Redis al instante para todas las variantes
    const jids = new Set<string>();
    if (remoteJid) jids.add(remoteJid);
    if (unifiedJid) jids.add(unifiedJid);
    if (phoneJid) jids.add(phoneJid);

    for (const jid of jids) {
      redis.set(`unread:${instanceName}:${jid}`, 0).catch(err => console.error(`[Redis] Error al resetear JID ${jid}:`, err.message));
    }
    
    console.log(`[EvolutionService] Registrada marca de lectura para ${instanceName}:${remoteJid} / ${unifiedJid} (phone: ${phoneJid}) a las ${nowInMs}`);
  }

  /**
   * Marcar mensajes como leídos
   */
  public static async markMessagesAsRead(instanceName: string, remoteJid: string, messageIds: string[], phoneJid?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Resolver el JID unificado (teléfono real) para que coincida exactamente con las claves de mensajes de la base de datos de Evolution
      let unifiedJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
      if (unifiedJid.endsWith('@lid') && this.lidCache.has(unifiedJid)) {
        unifiedJid = this.lidCache.get(unifiedJid)!;
      }

      const readMessages: any[] = [];
      const seen = new Set<string>();

      const addMessage = (rJid: string, msgId: string) => {
        const key = `${rJid}_${msgId}`;
        if (!seen.has(key)) {
          seen.add(key);
          readMessages.push({
            remoteJid: rJid,
            id: msgId,
            fromMe: false
          });
        }
      };

      for (const id of messageIds) {
        addMessage(remoteJid, id);
        if (unifiedJid !== remoteJid) {
          addMessage(unifiedJid, id);
        }
        if (phoneJid && phoneJid !== remoteJid && phoneJid !== unifiedJid) {
          addMessage(phoneJid, id);
        }
      }
      
      const response = await api.post(`/chat/markMessageAsRead/${instanceName}`, {
        readMessages
      });

      // Guardar el timestamp actual de lectura
      this.recordReadTimestamp(instanceName, remoteJid, phoneJid);

      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error marcando mensajes como leídos para ${remoteJid}:`, errorMsg);
      
      // Registrar de todos modos de manera preventiva por si la API falla pero queremos limpiar la UI
      this.recordReadTimestamp(instanceName, remoteJid, phoneJid);
      
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener los contadores de mensajes no leídos agrupados por remoteJid llamando a findMessages de la API (evita acceso directo a Postgres)
   */
  public static async getUnreadCountsFromApi(instanceName: string): Promise<Map<string, number>> {
    const unreadMap = new Map<string, number>();
    try {
      const pattern = `unread:${instanceName}:*`;
      const rawKeys = await redis.keys(pattern);
      const keys = Array.isArray(rawKeys) ? rawKeys : [];

      if (keys.length > 0) {
        // Consultar de forma masiva en pipeline para máxima velocidad (1ms)
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.get(key);
        }
        const results = await pipeline.exec();
        const safeResults = Array.isArray(results) ? results : [];

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const val = safeResults[i] ? safeResults[i][1] : null;
          const remoteJid = key.replace(`unread:${instanceName}:`, '');
          const count = Number(val) || 0;
          if (count > 0) {
            unreadMap.set(remoteJid, count);
          }
        }
      } else {
        // Fallback: Si Redis está vacío (ej: reinicio), poblar desde findMessages de la API
        console.log(`ℹ️ [Redis] Inicializando caché de no leídos para ${instanceName} desde mensajes históricos...`);
        const msgsResult = await api.post(`/chat/findMessages/${instanceName}`, { limit: 300 });
        const records = msgsResult.data?.messages?.records || msgsResult.data?.records || msgsResult.data || [];
        if (Array.isArray(records)) {
          const pipeline = redis.pipeline();
          for (const msg of records) {
            if (msg.key && msg.key.fromMe === false && msg.status !== 'READ') {
              const jid = msg.key.remoteJid;
              if (jid) {
                let cleanJid = jid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
                const redisKey = `unread:${instanceName}:${cleanJid}`;
                pipeline.incr(redisKey);
              }
            }
          }
          await pipeline.exec();

          // Obtener los datos recién ingresados a Redis
          const rawNewKeys = await redis.keys(pattern);
          const newKeys = Array.isArray(rawNewKeys) ? rawNewKeys : [];
          if (newKeys.length > 0) {
            const getPipeline = redis.pipeline();
            newKeys.forEach(k => getPipeline.get(k));
            const vals = await getPipeline.exec();
            const safeVals = Array.isArray(vals) ? vals : [];
            for (let i = 0; i < newKeys.length; i++) {
              const rJid = newKeys[i].replace(`unread:${instanceName}:`, '');
              const count = Number(safeVals[i] ? safeVals[i][1] : 0) || 0;
              unreadMap.set(rJid, count);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[EvolutionService] Error en getUnreadCountsFromApi (Redis):', err.message);
    }
    return unreadMap;
  }

  /**
   * Obtener la configuración actual del webhook desde la Evolution API
   */
  public static async getWebhookConfig(instanceName: string): Promise<any> {
    try {
      const response = await api.get(`/webhook/find/${instanceName}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Reiniciar la conexión de una instancia en Evolution API
   */
  public static async restartInstance(instanceName: string): Promise<any> {
    try {
      const response = await api.post(`/instance/restart/${instanceName}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Configurar webhook para una instancia existente en Evolution API
   */
  public static async configureWebhook(instanceName: string): Promise<boolean> {
    try {
      const BACKEND_URL = process.env.BACKEND_URL || 'https://zaza-click-20-production.up.railway.app';
      const webhookUrl = `${BACKEND_URL}/api/webhooks/whatsapp`;
        
      console.log(`🔌 [EvolutionService] Sincronizando webhook público para ${instanceName}: ${webhookUrl}`);

      const response = await api.post(`/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          byEvents: true,
          events: [
            'MESSAGES_UPSERT',
            'CHATS_UPDATE',
            'MESSAGES_UPDATE',
            'CONTACTS_UPSERT',
            'CONTACTS_UPDATE',
            'PRESENCE_UPDATE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED'
          ]
        }
      });
      return response.status === 200 || response.status === 201 || response.data?.success === true;
    } catch (err: any) {
      console.error(`[EvolutionService] Error configurando webhook para ${instanceName}:`, err.message);
      return false;
    }
  }

  /**
   * Obtener chats directamente desde la Evolution API sin procesar (para diagnóstico de campos como pushName o contact)
   */
  public static async getRawChats(instanceName: string): Promise<any> {
    try {
      const response = await api.post(`/chat/findChats/${instanceName}`, {});
      return response.data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtener contactos directamente desde la Evolution API sin procesar (para diagnóstico de agenda del teléfono)
   */
  public static async getRawContacts(instanceName: string): Promise<any> {
    try {
      const response = await api.post(`/chat/findContacts/${instanceName}`, {});
      return response.data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Guardar el nombre de un contacto en Redis (desde CONTACTS_UPSERT webhook).
   * Prioriza el campo 'name' (agenda del celular) sobre 'notify' (pushName/perfil).
   */
  public static async saveContactName(
    instanceName: string,
    jid: string,
    name?: string,
    notify?: string
  ): Promise<void> {
    // Solo guardar si hay un nombre real (agenda o notify)
    const contactName = name || notify;
    if (!contactName || !jid) return;

    try {
      let cleanJid = jid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');

      const redisKey = `contact:${instanceName}:${cleanJid}`;
      
      // Si tiene nombre de agenda (name), guardar con flag 'agenda' para darle prioridad
      if (name) {
        await redis.hset(redisKey, 'name', name, 'source', 'agenda');
        console.log(`📇 [Contacts] Guardado nombre de AGENDA para ${cleanJid}: "${name}"`);
      } else if (notify) {
        // Solo guardar notify si no hay ya un nombre de agenda
        const existing = await redis.hget(redisKey, 'source');
        if (existing !== 'agenda') {
          await redis.hset(redisKey, 'name', notify, 'source', 'notify');
          console.log(`📇 [Contacts] Guardado pushName/notify para ${cleanJid}: "${notify}"`);
        }
      }
    } catch (err: any) {
      console.error(`[Contacts] Error guardando nombre de contacto:`, err.message);
    }
  }

  /**
   * Obtener el nombre de un contacto desde Redis.
   */
  public static async getContactName(instanceName: string, jid: string): Promise<string | null> {
    try {
      let cleanJid = jid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
      const redisKey = `contact:${instanceName}:${cleanJid}`;
      return await redis.hget(redisKey, 'name');
    } catch {
      return null;
    }
  }

  /**
   * Obtener todos los grupos de la instancia
   */
  public static async getGroups(instanceName: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.get(`/group/fetchAllGroups/${instanceName}?getParticipants=true`);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo grupos para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Crear un nuevo grupo de WhatsApp
   */
  public static async createGroup(instanceName: string, subject: string, participants: string[]): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.post(`/group/create/${instanceName}`, {
        subject,
        participants
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error creando grupo para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Administrar participantes (añadir, remover, promover, degradar)
   */
  public static async updateGroupParticipants(
    instanceName: string,
    groupJid: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[]
  ): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.post(`/group/updateParticipant/${instanceName}?groupJid=${groupJid}`, {
        action,
        participants
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error actualizando participantes para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Obtener enlace de invitación del grupo
   */
  public static async getGroupInviteCode(instanceName: string, groupJid: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.get(`/group/inviteCode/${instanceName}?groupJid=${groupJid}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo código de invitación para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Revocar enlace de invitación del grupo
   */
  public static async revokeGroupInviteCode(instanceName: string, groupJid: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.post(`/group/revokeInviteCode/${instanceName}?groupJid=${groupJid}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error revocando código de invitación para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }
}
