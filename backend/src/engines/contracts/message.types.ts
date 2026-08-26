/**
 * Tipos de Parámetros de Mensajería Unificada — Zaza Click 2.0
 */

export interface SendTextMessageParams {
  instanceName: string;
  number: string;
  text: string;
  delay?: number;
}

export interface SendMediaMessageParams {
  instanceName: string;
  number: string;
  media: string;
  mediatype: 'image' | 'video' | 'document' | 'audio';
  mimetype: string;
  caption?: string;
  fileName?: string;
  delay?: number;
}

export interface SendAudioMessageParams {
  instanceName: string;
  number: string;
  audio: string; // URL o Base64
  delay?: number;
}

export interface SendLocationMessageParams {
  instanceName: string;
  number: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  delay?: number;
}

export interface SendContactMessageParams {
  instanceName: string;
  number: string;
  contact: Array<{
    fullName: string;
    wuid?: string;
    phoneNumber: string;
  }>;
  delay?: number;
}
