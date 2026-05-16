import type { Packet, QRToken } from './store.js';

export const QR_CODE_ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXYZ';
export const QR_CODE_LENGTH = 8;

function generateSafeCode(length: number): string {
  let code = '';
  const maxUnbiasedValue =
    Math.floor(256 / QR_CODE_ALPHABET.length) * QR_CODE_ALPHABET.length;

  while (code.length < length) {
    const array = new Uint8Array(length - code.length);
    crypto.getRandomValues(array);

    for (const byte of array) {
      if (byte >= maxUnbiasedValue) continue;
      code += QR_CODE_ALPHABET[byte % QR_CODE_ALPHABET.length];
      if (code.length === length) break;
    }
  }

  return code;
}

export function generatePacketCode(): string {
  return generateSafeCode(QR_CODE_LENGTH);
}

export function generateAssignmentCode(): string {
  return generateSafeCode(QR_CODE_LENGTH);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildQRUrl(token: string): string {
  const base =
    (import.meta.env.VITE_QR_BASE_URL as string | undefined)?.replace(
      /\/$/,
      ''
    ) ?? `${window.location.origin}/p`;
  return `${base}/${token}`;
}

export function buildTokenForPacketPage(
  packetCode: string,
  pageNumber: number
): string {
  return `${packetCode}-P${pageNumber}`;
}

export function buildTokenForGenericPage(
  assignmentCode: string,
  pageNumber: number
): string {
  return `${assignmentCode}-P${pageNumber}`;
}

export function buildPacketTokens(
  packet: Packet,
  assignmentId: string,
  pageCount: number
): QRToken[] {
  return Array.from({ length: pageCount }, (_, i) => {
    const pageNumber = i + 1;
    const token = buildTokenForPacketPage(packet.packetCode, pageNumber);
    return {
      token,
      assignmentId,
      templateVersion: 1,
      packetId: packet.id,
      pageNumber,
    };
  });
}

export function buildGenericTokens(
  assignmentCode: string,
  assignmentId: string,
  pageCount: number
): QRToken[] {
  return Array.from({ length: pageCount }, (_, i) => {
    const pageNumber = i + 1;
    const token = buildTokenForGenericPage(assignmentCode, pageNumber);
    return {
      token,
      assignmentId,
      templateVersion: 1,
      packetId: null as string | null,
      pageNumber,
    };
  });
}
