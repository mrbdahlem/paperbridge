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
    expect(normalizeAssignmentPayload(makePayload())).toEqual({
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
      },
      packets: [
        {
          id: 'packet_1',
          assignmentId: 'assignment_1',
          packetCode: '9X7K2VBM',
          mode: 'anonymous',
          studentId: null,
          createdAt: '2026-06-12T00:00:00.000Z',
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
});
