import { describe, expect, it } from 'vitest';
import { normalizeAssignmentPayload } from '../../server/assignment-repository.js';

function makePayload(overrides = {}) {
  return {
    assignment: {
      id: 'assignment_1',
      title: 'EX10 Relays',
      classLabel: 'Period 4',
      pageCount: 2,
      qrMode: 'anonymous',
      packetCount: 1,
      templateVersion: 1,
      ownerUserId: null,
      createdAt: '2026-06-12T00:00:00.000Z',
      ...overrides.assignment,
    },
    packets: overrides.packets ?? [
      {
        id: 'packet_1',
        assignmentId: 'assignment_1',
        packetCode: '9X7K2VBM',
        mode: 'anonymous',
        createdAt: '2026-06-12T00:00:00.000Z',
      },
    ],
    tokens: overrides.tokens ?? [
      {
        token: '9X7K2VBM-P1',
        assignmentId: 'assignment_1',
        templateVersion: 1,
        packetId: 'packet_1',
        pageNumber: 1,
      },
    ],
  };
}

describe('assignment repository payload normalization', () => {
  it('normalizes assignment, packet, and QR token payloads', () => {
    const normalized = normalizeAssignmentPayload(
      makePayload({
        assignment: {
          ownerUserId: 'spoofed_user',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        packets: [
          {
            id: 'packet_1',
            assignmentId: 'assignment_1',
            packetCode: '9X7K2VBM',
            mode: 'anonymous',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    );

    expect(normalized).toEqual({
      assignment: {
        id: 'assignment_1',
        title: 'EX10 Relays',
        classLabel: 'Period 4',
        pageCount: 2,
        qrMode: 'anonymous',
        packetCount: 1,
        templateVersion: 1,
        ownerUserId: null,
        createdAt: normalized.assignment.createdAt,
      },
      packets: [
        {
          id: 'packet_1',
          assignmentId: 'assignment_1',
          packetCode: '9X7K2VBM',
          mode: 'anonymous',
          studentId: null,
          createdAt: normalized.assignment.createdAt,
        },
      ],
      tokens: [
        {
          token: '9X7K2VBM-P1',
          assignmentId: 'assignment_1',
          templateVersion: 1,
          packetId: 'packet_1',
          pageNumber: 1,
          expiresAt: null,
        },
      ],
    });
    expect(normalized.assignment.createdAt).not.toBe(
      '2026-01-01T00:00:00.000Z'
    );
  });

  it('rejects invalid assignment counters before database writes', () => {
    console.log('[TEST] packetCount validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({ assignment: { packetCount: -1 } })
      )
    ).toThrow(/packetCount/u);
    console.log('[TEST] assignment templateVersion validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({ assignment: { templateVersion: 0 } })
      )
    ).toThrow(/templateVersion/u);
    console.log('[TEST] token templateVersion validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          tokens: [{ ...makePayload().tokens[0], templateVersion: 0 }],
        })
      )
    ).toThrow(/templateVersion/u);
  });

  it('derives assignment packetCount from submitted packets', () => {
    const normalized = normalizeAssignmentPayload(
      makePayload({
        assignment: { packetCount: 99 },
        packets: [
          {
            id: 'packet_1',
            assignmentId: 'assignment_1',
            packetCode: '9X7K2VBM',
            mode: 'anonymous',
          },
          {
            id: 'packet_2',
            assignmentId: 'assignment_1',
            packetCode: '8X7K2VBM',
            mode: 'anonymous',
          },
        ],
        tokens: [
          {
            ...makePayload().tokens[0],
            packetId: 'packet_1',
          },
        ],
      })
    );

    expect(normalized.assignment.packetCount).toBe(2);
  });

  it('rejects duplicate packet ids before database writes', () => {
    console.log('[TEST] duplicate packet.id validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          packets: [
            {
              id: 'packet_1',
              assignmentId: 'assignment_1',
              packetCode: '9X7K2VBM',
              mode: 'anonymous',
            },
            {
              id: 'packet_1',
              assignmentId: 'assignment_1',
              packetCode: '8X7K2VBM',
              mode: 'anonymous',
            },
          ],
        })
      )
    ).toThrow(/packet\.id/u);
  });

  it('rejects duplicate QR tokens before database writes', () => {
    console.log('[TEST] duplicate token.token validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          tokens: [
            {
              token: '9X7K2VBM-P1',
              assignmentId: 'assignment_1',
              packetId: 'packet_1',
              pageNumber: 1,
            },
            {
              token: '9X7K2VBM-P1',
              assignmentId: 'assignment_1',
              packetId: 'packet_1',
              pageNumber: 2,
            },
          ],
        })
      )
    ).toThrow(/token\.token/u);
  });

  it('rejects nested records for a different assignment', () => {
    console.log('[TEST] packet.assignmentId validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          packets: [
            {
              id: 'packet_1',
              assignmentId: 'assignment_other',
              packetCode: '9X7K2VBM',
              mode: 'anonymous',
            },
          ],
        })
      )
    ).toThrow(/packet\.assignmentId/u);
    console.log('[TEST] token.assignmentId validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          tokens: [
            {
              token: '9X7K2VBM-P1',
              assignmentId: 'assignment_other',
              packetId: 'packet_1',
              pageNumber: 1,
            },
          ],
        })
      )
    ).toThrow(/token\.assignmentId/u);
  });

  it('rejects QR tokens for packets outside the submitted payload', () => {
    console.log('[TEST] token.packetId validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          tokens: [
            {
              token: '9X7K2VBM-P1',
              assignmentId: 'assignment_1',
              packetId: 'packet_missing',
              pageNumber: 1,
            },
          ],
        })
      )
    ).toThrow(/token\.packetId/u);
  });

  it('rejects invalid optional QR token field types before database writes', () => {
    console.log('[TEST] token.packetId type validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          tokens: [
            {
              ...makePayload().tokens[0],
              packetId: { id: 'packet_1' },
            },
          ],
        })
      )
    ).toThrow(/token\.packetId/u);

    console.log('[TEST] token.expiresAt type validation');
    expect(() =>
      normalizeAssignmentPayload(
        makePayload({
          tokens: [
            {
              ...makePayload().tokens[0],
              expiresAt: { at: '2026-06-13T00:00:00.000Z' },
            },
          ],
        })
      )
    ).toThrow(/token\.expiresAt/u);
  });
});
