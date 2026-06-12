import {
  deleteAssignment,
  getAssignments,
  getPackets,
  resolveToken,
  saveAssignment,
  savePackets,
  saveTokens,
  type Assignment,
  type Packet,
  type QRToken,
} from './store.js';

interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  unavailable: boolean;
}

interface AssignmentListResponse {
  assignments: Assignment[];
}

interface AssignmentDetailResponse {
  assignment: Assignment;
  packets: Packet[];
  tokens: QRToken[];
}

interface QRTokenResponse {
  token: QRToken;
}

export interface AssignmentBundle {
  assignment: Assignment;
  packets: Packet[];
  tokens: QRToken[];
}

export interface DashboardAssignments {
  assignments: Assignment[];
  packets: Packet[];
  durable: boolean;
}

function fallbackDashboard(): DashboardAssignments {
  return {
    assignments: getAssignments(),
    packets: getPackets(),
    durable: false,
  };
}

function persistLocal(bundle: AssignmentBundle): void {
  saveAssignment(bundle.assignment);
  savePackets(bundle.packets);
  saveTokens(bundle.tokens);
}

function isApiUnavailable(status: number, contentType: string): boolean {
  return (
    status === 0 ||
    status === 503 ||
    (status === 404 && !contentType.includes('application/json'))
  );
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const response = await fetch(path, { ...init, headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? ((await response.json()) as T)
      : null;

    return {
      ok: response.ok,
      status: response.status,
      data,
      unavailable: isApiUnavailable(response.status, contentType),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      unavailable: true,
    };
  }
}

function apiError(action: string, response: ApiResponse<unknown>): Error {
  const data = response.data as { error?: string; message?: string } | null;
  return new Error(data?.message || data?.error || `${action} failed`);
}

export async function saveGeneratedAssignment(
  bundle: AssignmentBundle
): Promise<void> {
  const response = await requestJson<AssignmentDetailResponse>(
    '/api/assignments',
    {
      method: 'POST',
      body: JSON.stringify(bundle),
    }
  );

  if (response.ok) return;
  if (response.unavailable) {
    persistLocal(bundle);
    return;
  }
  throw apiError('Saving assignment', response);
}

export async function loadDashboardAssignments(): Promise<DashboardAssignments> {
  const listResponse =
    await requestJson<AssignmentListResponse>('/api/assignments');
  if (listResponse.unavailable) return fallbackDashboard();
  if (!listResponse.ok || !listResponse.data) {
    throw apiError('Loading assignments', listResponse);
  }

  const details = await Promise.all(
    listResponse.data.assignments.map(async (assignment) => {
      const detailResponse = await requestJson<AssignmentDetailResponse>(
        `/api/assignments/${encodeURIComponent(assignment.id)}`
      );
      if (detailResponse.unavailable) return null;
      if (!detailResponse.ok || !detailResponse.data) {
        throw apiError('Loading assignment details', detailResponse);
      }
      return detailResponse.data;
    })
  );

  if (details.some((detail) => detail === null)) return fallbackDashboard();

  return {
    assignments: listResponse.data.assignments,
    packets: details.flatMap((detail) => detail?.packets || []),
    durable: true,
  };
}

export async function removeAssignment(id: string): Promise<void> {
  const response = await requestJson<{ ok: boolean }>(
    `/api/assignments/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );

  if (response.ok) return;
  if (response.unavailable || response.status === 404) {
    deleteAssignment(id);
    return;
  }
  throw apiError('Deleting assignment', response);
}

export async function resolveQRToken(
  token: string
): Promise<QRToken | undefined> {
  const response = await requestJson<QRTokenResponse>(
    `/api/qr-tokens/${encodeURIComponent(token)}`
  );

  if (response.ok) return response.data?.token;
  if (response.unavailable || response.status === 404) {
    return resolveToken(token);
  }
  throw apiError('Resolving QR token', response);
}
