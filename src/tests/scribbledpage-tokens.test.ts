import {
  buildGenericTokens,
  buildPacketTokens,
  buildTokenForGenericPage,
  buildTokenForPacketPage,
  buildQRUrl,
  generateAssignmentCode,
  generateId,
  generatePacketCode,
  QR_CODE_ALPHABET,
  QR_CODE_LENGTH,
} from '../js/scribbledpage/tokens';

describe('ScribbledPage token helpers', () => {
  const safeCodePattern = new RegExp(
    `^[${QR_CODE_ALPHABET}]{${QR_CODE_LENGTH}}$`
  );

  it('generates packet and assignment codes with the safe QR alphabet', () => {
    expect(generatePacketCode()).toMatch(safeCodePattern);
    expect(generateAssignmentCode()).toMatch(safeCodePattern);
  });

  it('excludes vowels and ambiguous characters from generated QR codes', () => {
    expect(QR_CODE_ALPHABET).not.toMatch(/[AEIOU01]/);
  });

  it('builds packet and generic page token strings', () => {
    expect(buildTokenForPacketPage('9X7K2VBM', 2)).toBe('9X7K2VBM-P2');
    expect(buildTokenForGenericPage('M4T8Z6RC', 3)).toBe('M4T8Z6RC-P3');
  });

  it('creates packet-scoped QR metadata for each page', () => {
    const packet = {
      id: 'packet_1',
      assignmentId: 'assignment_1',
      packetCode: '9X7K2VBM',
      mode: 'anonymous' as const,
      createdAt: '2026-05-13T00:00:00.000Z',
    };

    expect(buildPacketTokens(packet, 'assignment_1', 3)).toEqual([
      {
        token: '9X7K2VBM-P1',
        assignmentId: 'assignment_1',
        templateVersion: 1,
        packetId: 'packet_1',
        pageNumber: 1,
      },
      {
        token: '9X7K2VBM-P2',
        assignmentId: 'assignment_1',
        templateVersion: 1,
        packetId: 'packet_1',
        pageNumber: 2,
      },
      {
        token: '9X7K2VBM-P3',
        assignmentId: 'assignment_1',
        templateVersion: 1,
        packetId: 'packet_1',
        pageNumber: 3,
      },
    ]);
  });

  it('creates generic QR metadata without packet ids', () => {
    expect(buildGenericTokens('M4T8Z6RC', 'assignment_1', 2)).toEqual([
      {
        token: 'M4T8Z6RC-P1',
        assignmentId: 'assignment_1',
        templateVersion: 1,
        packetId: null,
        pageNumber: 1,
      },
      {
        token: 'M4T8Z6RC-P2',
        assignmentId: 'assignment_1',
        templateVersion: 1,
        packetId: null,
        pageNumber: 2,
      },
    ]);
  });

  it('builds stable prefixed ids', () => {
    expect(generateId('assignment')).toMatch(
      /^assignment_[a-z0-9]+_[a-z0-9]{5}$/
    );
  });
});

describe('buildQRUrl', () => {
  const originalEnv = import.meta.env.VITE_QR_BASE_URL;

  afterEach(() => {
    (import.meta.env as Record<string, unknown>).VITE_QR_BASE_URL = originalEnv;
  });

  it('uses VITE_QR_BASE_URL when set', () => {
    (import.meta.env as Record<string, unknown>).VITE_QR_BASE_URL =
      'https://scan.example.com';
    expect(buildQRUrl('9X7K2VBM-P2')).toBe(
      'https://scan.example.com/9X7K2VBM-P2'
    );
  });

  it('strips trailing slash from VITE_QR_BASE_URL', () => {
    (import.meta.env as Record<string, unknown>).VITE_QR_BASE_URL =
      'https://scan.example.com/';
    expect(buildQRUrl('M4T8Z6RC-P1')).toBe(
      'https://scan.example.com/M4T8Z6RC-P1'
    );
  });

  it('appends the token as the final path segment', () => {
    (import.meta.env as Record<string, unknown>).VITE_QR_BASE_URL =
      'https://scan.example.com/qr';
    expect(buildQRUrl('MYTOKEN')).toMatch(/\/MYTOKEN$/);
  });

  // The window.location.origin fallback is browser-only: Vite statically
  // inlines import.meta.env values, making runtime env mutation unreliable
  // in the test environment. It is verified by code inspection in tokens.ts.
});
