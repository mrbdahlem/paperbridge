const VALID_QR_MODES = new Set(['generic', 'anonymous']);

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapAssignment(row) {
  return {
    id: row.id,
    title: row.title,
    classLabel: row.class_label,
    pageCount: row.page_count,
    qrMode: row.qr_mode,
    packetCount: row.packet_count,
    templateVersion: row.template_version,
    ownerUserId: row.owner_user_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPacket(row) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    packetCode: row.packet_code,
    mode: row.mode,
    studentId: row.student_id,
    createdAt: toIso(row.created_at),
  };
}

function mapQRToken(row) {
  return {
    token: row.token,
    assignmentId: row.assignment_id,
    templateVersion: row.template_version,
    packetId: row.packet_id,
    pageNumber: row.page_number,
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at),
  };
}

function normalizeAssignment(input) {
  const assignment = input?.assignment ?? input;
  const title = String(assignment?.title || '').trim();
  const pageCount = Number(assignment?.pageCount);
  const qrMode = assignment?.qrMode;

  const packetCount = Number(assignment?.packetCount ?? 0);
  const templateVersion = Number(assignment?.templateVersion ?? 1);

  if (!assignment?.id || typeof assignment.id !== 'string') {
    throw new Error('assignment.id is required');
  }
  if (!title) {
    throw new Error('assignment.title is required');
  }
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error('assignment.pageCount must be a positive integer');
  }
  if (!VALID_QR_MODES.has(qrMode)) {
    throw new Error('assignment.qrMode must be generic or anonymous');
  }
  if (!Number.isInteger(packetCount) || packetCount < 0) {
    throw new Error('assignment.packetCount must be a non-negative integer');
  }
  if (!Number.isInteger(templateVersion) || templateVersion <= 0) {
    throw new Error('assignment.templateVersion must be a positive integer');
  }

  return {
    id: assignment.id,
    title,
    classLabel: String(assignment.classLabel || ''),
    pageCount,
    qrMode,
    packetCount,
    templateVersion,
    ownerUserId: assignment.ownerUserId || null,
    createdAt: assignment.createdAt || new Date().toISOString(),
  };
}

function normalizePacket(packet, assignmentId) {
  if (!packet?.id || typeof packet.id !== 'string') {
    throw new Error('packet.id is required');
  }
  if (!packet?.packetCode || typeof packet.packetCode !== 'string') {
    throw new Error('packet.packetCode is required');
  }
  if (!VALID_QR_MODES.has(packet.mode)) {
    throw new Error('packet.mode must be generic or anonymous');
  }
  if (packet.assignmentId && packet.assignmentId !== assignmentId) {
    throw new Error('packet.assignmentId must match assignment.id');
  }

  return {
    id: packet.id,
    assignmentId: packet.assignmentId || assignmentId,
    packetCode: packet.packetCode,
    mode: packet.mode,
    studentId: packet.studentId || null,
    createdAt: packet.createdAt || new Date().toISOString(),
  };
}

function normalizeQRToken(token, assignmentId) {
  if (!token?.token || typeof token.token !== 'string') {
    throw new Error('token.token is required');
  }
  const pageNumber = Number(token.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    throw new Error('token.pageNumber must be a positive integer');
  }
  if (token.assignmentId && token.assignmentId !== assignmentId) {
    throw new Error('token.assignmentId must match assignment.id');
  }

  return {
    token: token.token,
    assignmentId: token.assignmentId || assignmentId,
    templateVersion: Number.isInteger(Number(token.templateVersion))
      ? Number(token.templateVersion)
      : 1,
    packetId: token.packetId || null,
    pageNumber,
    expiresAt: token.expiresAt || null,
  };
}

export function normalizeAssignmentPayload(input) {
  const assignment = normalizeAssignment(input);
  const packets = (input?.packets || []).map((packet) =>
    normalizePacket(packet, assignment.id)
  );
  const packetIds = new Set(packets.map((packet) => packet.id));
  const tokens = (input?.tokens || []).map((token) => {
    const normalizedToken = normalizeQRToken(token, assignment.id);

    if (
      normalizedToken.packetId !== null &&
      !packetIds.has(normalizedToken.packetId)
    ) {
      throw new Error('token.packetId must reference a submitted packet');
    }

    return normalizedToken;
  });

  return { assignment, packets, tokens };
}

export function createAssignmentRepository(database) {
  return {
    async listAssignments() {
      const rows = await database`
        select *
        from assignments
        order by created_at desc
      `;
      return rows.map(mapAssignment);
    },

    async getAssignment(id) {
      const assignmentRows = await database`
        select *
        from assignments
        where id = ${id}
        limit 1
      `;
      const assignment = assignmentRows[0];
      if (!assignment) return null;

      const [packetRows, tokenRows] = await Promise.all([
        database`
          select *
          from packets
          where assignment_id = ${id}
          order by created_at asc, id asc
        `,
        database`
          select *
          from qr_tokens
          where assignment_id = ${id}
          order by packet_id asc nulls first, page_number asc, token asc
        `,
      ]);

      return {
        assignment: mapAssignment(assignment),
        packets: packetRows.map(mapPacket),
        tokens: tokenRows.map(mapQRToken),
      };
    },

    async createAssignment(input) {
      const { assignment, packets, tokens } = normalizeAssignmentPayload(input);

      await database.begin(async (transaction) => {
        await transaction`
          insert into assignments (
            id,
            title,
            class_label,
            page_count,
            qr_mode,
            packet_count,
            template_version,
            owner_user_id,
            created_at,
            updated_at
          )
          values (
            ${assignment.id},
            ${assignment.title},
            ${assignment.classLabel},
            ${assignment.pageCount},
            ${assignment.qrMode},
            ${assignment.packetCount},
            ${assignment.templateVersion},
            ${assignment.ownerUserId},
            ${assignment.createdAt},
            ${assignment.createdAt}
          )
        `;

        for (const packet of packets) {
          await transaction`
            insert into packets (
              id,
              assignment_id,
              packet_code,
              mode,
              student_id,
              created_at
            )
            values (
              ${packet.id},
              ${packet.assignmentId},
              ${packet.packetCode},
              ${packet.mode},
              ${packet.studentId},
              ${packet.createdAt}
            )
          `;
        }

        for (const token of tokens) {
          await transaction`
            insert into qr_tokens (
              token,
              assignment_id,
              template_version,
              packet_id,
              page_number,
              expires_at
            )
            values (
              ${token.token},
              ${token.assignmentId},
              ${token.templateVersion},
              ${token.packetId},
              ${token.pageNumber},
              ${token.expiresAt}
            )
          `;
        }
      });

      return this.getAssignment(assignment.id);
    },

    async deleteAssignment(id) {
      const rows = await database`
        delete from assignments
        where id = ${id}
        returning id
      `;
      return rows.length > 0;
    },

    async resolveQRToken(token) {
      const rows = await database`
        select *
        from qr_tokens
        where token = ${token}
        limit 1
      `;
      return rows[0] ? mapQRToken(rows[0]) : null;
    },
  };
}
