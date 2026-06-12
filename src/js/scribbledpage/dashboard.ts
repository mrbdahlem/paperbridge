import {
  type DashboardAssignments,
  loadDashboardAssignments,
  removeAssignment,
} from './assignment-data.js';
import {
  getAssignments,
  getPackets,
  type Assignment,
  type Packet,
} from './store.js';
import { initScribbledPageI18n, pt } from './scribbledpage-i18n.js';
import { mountThemeToggle } from './theme.js';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function modeBadge(mode: string): string {
  if (mode === 'anonymous') {
    return `<span class="pb-badge pb-badge-teal">${escHtml(pt('dashboard.mode.anonymous'))}</span>`;
  }
  return `<span class="pb-badge pb-badge-stone">${escHtml(pt('dashboard.mode.generic'))}</span>`;
}

function renderAssignmentCard(
  assignment: Assignment,
  packets: Packet[]
): string {
  const accentClass =
    assignment.qrMode === 'generic' ? 'pb-assignment-card--generic' : '';
  const label = assignment.classLabel
    ? `<span style="color:var(--pb-text-3);font-size:.75rem">${escHtml(assignment.classLabel)}</span>`
    : '';

  const pagesText = pt('dashboard.card.pages', { count: assignment.pageCount });
  const packetsText = pt('dashboard.card.packets', { count: packets.length });
  const createdText = pt('dashboard.card.created', {
    date: formatDate(assignment.createdAt),
  });
  const deleteTitle = escHtml(pt('dashboard.card.delete'));
  const downloadLabel = escHtml(pt('dashboard.card.downloadPackets'));

  return `
    <div class="pb-assignment-card ${accentClass}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.35rem">
            <h2 style="font-weight:700;font-size:.9375rem;color:var(--pb-text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(assignment.title)}</h2>
            ${label}
            ${modeBadge(assignment.qrMode)}
          </div>
          <p style="color:var(--pb-text-3);font-size:.75rem;line-height:1.5">
            ${pagesText} &middot; ${packetsText} &middot; ${createdText}
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
          <a
            href="create-assignment.html?id=${encodeURIComponent(assignment.id)}"
            class="pb-btn pb-btn-accent"
            style="font-size:.75rem;padding:.3rem .75rem"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ${downloadLabel}
          </a>
          <button
            data-delete="${assignment.id}"
            class="pb-btn pb-btn-danger"
            style="padding:.3rem .5rem"
            title="${deleteTitle}"
            aria-label="${deleteTitle}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

async function render(): Promise<void> {
  let loadFailed: boolean;
  let data: DashboardAssignments;
  try {
    data = await loadDashboardAssignments();
    loadFailed = !data.durable;
  } catch (error) {
    console.error(error);
    loadFailed = true;
    data = {
      assignments: getAssignments(),
      packets: getPackets(),
      durable: false,
    };
  }
  const assignments = data.assignments.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const allPackets = data.packets;
  const packetsByAssignment = new Map<string, Packet[]>();
  for (const packet of allPackets) {
    const packets = packetsByAssignment.get(packet.assignmentId) || [];
    packets.push(packet);
    packetsByAssignment.set(packet.assignmentId, packets);
  }

  const emptyEl = document.getElementById('pb-empty')!;
  const dashboardEl = document.getElementById('pb-dashboard')!;
  const listEl = document.getElementById('pb-assignment-list')!;
  const subtitleEl = document.getElementById('pb-subtitle');
  const statAssignments = document.getElementById('pb-stat-assignments');
  const statPackets = document.getElementById('pb-stat-packets');

  if (assignments.length === 0) {
    emptyEl.style.display = '';
    dashboardEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  dashboardEl.style.display = '';

  if (subtitleEl) {
    subtitleEl.textContent = loadFailed
      ? pt('dashboard.loadFallback')
      : pt('dashboard.subtitle', {
          count: assignments.length,
        });
  }
  if (statAssignments) statAssignments.textContent = String(assignments.length);
  if (statPackets) statPackets.textContent = String(allPackets.length);

  // Assignment fields are escaped in renderAssignmentCard before interpolation.
  // eslint-disable-next-line no-unsanitized/property
  listEl.innerHTML = assignments
    .map((assignment) =>
      renderAssignmentCard(
        assignment,
        packetsByAssignment.get(assignment.id) || []
      )
    )
    .join('');

  listEl
    .querySelectorAll<HTMLButtonElement>('button[data-delete]')
    .forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delete!;
        const assignment = assignments.find((a) => a.id === id);
        if (!assignment) return;
        const msg = pt('dashboard.card.deleteConfirm', {
          title: assignment.title,
        });
        if (!confirm(msg)) return;
        await removeAssignment(id);
        await render();
      });
    });
}

function mountMobileMenu(): void {
  const btn = document.getElementById('pb-mobile-menu-btn');
  const menu = document.getElementById('pb-mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute(
      'aria-label',
      open ? pt('nav.menuClose') : pt('nav.menuOpen')
    );
  });
}

(async () => {
  await initScribbledPageI18n();
  mountThemeToggle();
  mountMobileMenu();
  await render();
})();
