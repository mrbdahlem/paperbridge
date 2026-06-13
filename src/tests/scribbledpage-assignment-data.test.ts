import { vi } from 'vitest';
import {
  loadDashboardAssignments,
  removeAssignment,
  resolveQRToken,
  saveGeneratedAssignment,
  type AssignmentBundle,
} from '../js/scribbledpage/assignment-data';
import {
  getAssignments,
  getPackets,
  saveAssignment,
  savePackets,
  saveTokens,
  type Assignment,
  type Packet,
  type QRToken,
} from '../js/scribbledpage/store';

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'assignment_1',
    title: 'Test Assignment',
    classLabel: 'Period 1',
    pageCount: 3,
    qrMode: 'anonymous',
    packetCount: 1,
    createdAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  };
}

function makePacket(overrides: Partial<Packet> = {}): Packet {
  return {
    id: 'packet_1',
    assignmentId: 'assignment_1',
    packetCode: 'PACKET01',
    mode: 'anonymous',
    createdAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  };
}

function makeToken(overrides: Partial<QRToken> = {}): QRToken {
  return {
    token: 'TOKEN-P1',
    assignmentId: 'assignment_1',
    templateVersion: 1,
    packetId: 'packet_1',
    pageNumber: 1,
    ...overrides,
  };
}

function makeBundle(): AssignmentBundle {
  return {
    assignment: makeAssignment(),
    packets: [makePacket()],
    tokens: [makeToken()],
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('assignment API persistence adapter', () => {
  it('posts generated assignments to the durable API', async () => {
    const bundle = makeBundle();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ assignment: bundle }));

    await saveGeneratedAssignment(bundle);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assignments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(bundle),
      })
    );
    expect(getAssignments()).toEqual([]);
  });

  it('falls back to localStorage when save API is unavailable', async () => {
    const bundle = makeBundle();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'Database Unavailable' }, { status: 503 })
    );

    await saveGeneratedAssignment(bundle);

    expect(getAssignments()).toEqual([bundle.assignment]);
    expect(getPackets()).toEqual(bundle.packets);
  });

  it('falls back to localStorage when the save API route is absent', async () => {
    const bundle = makeBundle();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'Not Found', statusCode: 404 }, { status: 404 })
    );

    await saveGeneratedAssignment(bundle);

    expect(getAssignments()).toEqual([bundle.assignment]);
    expect(getPackets()).toEqual(bundle.packets);
  });

  it('loads dashboard data from assignment detail API responses', async () => {
    const assignment = makeAssignment();
    const packet = makePacket();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ assignments: [assignment] }))
      .mockResolvedValueOnce(
        jsonResponse({ assignment, packets: [packet], tokens: [makeToken()] })
      );

    const result = await loadDashboardAssignments();

    expect(result).toEqual({
      assignments: [assignment],
      packets: [packet],
      durable: true,
    });
  });

  it('skips assignments deleted between list and detail API responses', async () => {
    const assignment = makeAssignment();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ assignments: [assignment] }))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Assignment Not Found' }, { status: 404 })
      );

    const result = await loadDashboardAssignments();

    expect(result).toEqual({
      assignments: [],
      packets: [],
      durable: true,
    });
  });

  it('falls back to local dashboard data when the API route is absent', async () => {
    const assignment = makeAssignment();
    const packet = makePacket();
    saveAssignment(assignment);
    savePackets([packet]);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain' },
      })
    );

    const result = await loadDashboardAssignments();

    expect(result).toEqual({
      assignments: [assignment],
      packets: [packet],
      durable: false,
    });
  });

  it('deletes through the durable API when available', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await removeAssignment('assignment_1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assignments/assignment_1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('falls back to local delete on network failure', async () => {
    saveAssignment(makeAssignment());
    savePackets([makePacket()]);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));

    await removeAssignment('assignment_1');

    expect(getAssignments()).toEqual([]);
    expect(getPackets()).toEqual([]);
  });

  it('resolves QR tokens through the API', async () => {
    const token = makeToken();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ token }));

    await expect(resolveQRToken('TOKEN-P1')).resolves.toEqual(token);
  });

  it('does not fall back to stale local tokens on server 404', async () => {
    const token = makeToken();
    saveTokens([token]);
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'QR Token Not Found' }, { status: 404 })
    );

    await expect(resolveQRToken('TOKEN-P1')).resolves.toBeUndefined();
  });

  it('falls back to local token resolution when the API is unavailable', async () => {
    const token = makeToken();
    saveTokens([token]);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));

    await expect(resolveQRToken('TOKEN-P1')).resolves.toEqual(token);
  });

  it('falls back to local token resolution when the QR API route is absent', async () => {
    const token = makeToken();
    saveTokens([token]);
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'Not Found', statusCode: 404 }, { status: 404 })
    );

    await expect(resolveQRToken('TOKEN-P1')).resolves.toEqual(token);
  });
});
