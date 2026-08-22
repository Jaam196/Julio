import { Ticket, TicketZone } from '../types';

/**
 * Checks if a ticket is currently ACTIVE in circulation.
 * Active states: 'waiting', 'active', 'pending', 'missing'.
 * Non-active / completed / archived states: 'delivered', 'deleted_pending'.
 */
export function isActiveTicket(ticket: Ticket | null | undefined): boolean {
  if (!ticket) return false;
  return ticket.status === 'waiting' || ticket.status === 'active' || ticket.status === 'pending' || ticket.status === 'missing';
}

/**
 * Returns all currently active tickets from an array.
 */
export function getActiveTickets(tickets: Ticket[]): Ticket[] {
  if (!Array.isArray(tickets)) return [];
  return tickets.filter(isActiveTicket);
}

/**
 * Returns a Set of active ticket number strings (e.g. Set {"657", "001", "157"}).
 * Reused numbers that are completed/delivered in history are EXCLUDED, so they can re-enter.
 */
export function getActiveTicketNumbers(tickets: Ticket[]): Set<string> {
  if (!Array.isArray(tickets)) return new Set();
  const set = new Set<string>();
  for (const t of tickets) {
    if (isActiveTicket(t) && t.number) {
      const clean = String(t.number).trim();
      set.add(clean);
      // Also add leading zeros normalized if 1-3 digits
      const parsed = parseInt(clean, 10);
      if (!isNaN(parsed)) {
        set.add(String(parsed).padStart(3, '0'));
        set.add(String(parsed));
      }
    }
  }
  return set;
}

/**
 * Normalizes ticket numbers to standard 3-digit format (000-999).
 */
export function formatTicketNumber(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 0 && num <= 999) {
    return String(num).padStart(3, '0');
  }
  return str;
}

/**
 * Strict validator for restaurant ticket numbers.
 * Enforces ALWAYS EXACTLY 3 digits (000-999).
 */
export function isValidTicketNumber(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return /^\d{3}$/.test(str);
}

/**
 * Normalizes a zone string for consistent comparison.
 * Trims, converts to lowercase.
 * Examples:
 * normalizeZone(" Cocina ") -> "cocina"
 * normalizeZone("COCINA") -> "cocina"
 * normalizeZone("cocina") -> "cocina"
 * normalizeZone(null/undefined/"") -> "manual"
 */
export function normalizeZone(zone?: string | null): string {
  if (!zone) return 'manual';
  const trimmed = String(zone).trim().toLowerCase();
  return trimmed || 'manual';
}

/**
 * Generates a unique composite key for a ticket number and zone.
 * Example: getTicketZoneKey("504", "cocina") -> "504|cocina"
 * Example: getTicketZoneKey("504", "linea") -> "504|linea"
 * Example: getTicketZoneKey("504", null) -> "504|manual"
 */
export function getTicketZoneKey(ticketNumber: string, zone?: string | null): string {
  const normNum = String(parseInt(ticketNumber, 10) || ticketNumber).trim();
  return `${normNum}|${normalizeZone(zone)}`;
}

/**
 * Returns a normalized zones array for any ticket.
 * If ticket.zones exists and has items, returns it.
 * Otherwise creates a synthetic zone array based on ticket.zone or 'Sin asignar'.
 */
export function getTicketZones(ticket: Ticket): TicketZone[] {
  if (ticket.zones && Array.isArray(ticket.zones) && ticket.zones.length > 0) {
    return ticket.zones;
  }
  const defaultZoneName = ticket.zone && ticket.zone.trim() ? ticket.zone.trim() : 'Sin asignar';
  const isDone = ticket.status === 'delivered' || ticket.status === 'deleted_pending';
  return [
    {
      id: `${ticket.number}:${defaultZoneName.toLowerCase()}`,
      zone: defaultZoneName,
      status: isDone ? 'completed' : 'pending',
      createdAt: ticket.createdAt,
      completedAt: ticket.completedAt
    }
  ];
}

/**
 * Returns all pending zones for a ticket.
 */
export function getPendingZones(ticket: Ticket): TicketZone[] {
  const zones = getTicketZones(ticket);
  return zones.filter((z) => z.status === 'pending');
}

/**
 * Central duplicate checker function.
 * Rule: MISMO NÚMERO + MISMA ZONA PENDIENTE = DUPLICADO (returns true)
 * MISMO NÚMERO + ZONA DIFERENTE = PERMITIDO PARA FUSIONAR (returns false)
 * Only checks ACTIVE tickets (waiting, pending, active, missing).
 */
export function isDuplicateTicket(tickets: Ticket[], ticketNumber: string, zone?: string | null): boolean {
  const normNum = formatTicketNumber(ticketNumber);
  const targetZoneNorm = normalizeZone(zone);

  return tickets.some((t) => {
    if (!isActiveTicket(t)) return false;

    const tNorm = formatTicketNumber(t.number);
    if (tNorm !== normNum && String(t.number).trim() !== String(ticketNumber).trim()) return false;

    const zones = getTicketZones(t);
    return zones.some((z) => normalizeZone(z.zone) === targetZoneNorm && z.status === 'pending');
  });
}

/**
 * Ensures that no two ACTIVE tickets (waiting, active, pending, missing) have the same ticket number.
 * Merges any duplicate active ticket objects by combining their zones into a single ticket.
 */
export function sanitizeAndMergeTickets(tickets: Ticket[]): Ticket[] {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];

  const activeMap = new Map<string, Ticket>();
  const nonActiveTickets: Ticket[] = [];

  for (const t of tickets) {
    if (!t || t.number === undefined || t.number === null) continue;

    if (!isActiveTicket(t)) {
      nonActiveTickets.push(t);
      continue;
    }

    const normNum = formatTicketNumber(t.number);
    if (!normNum || normNum === 'NaN') continue;

    if (!activeMap.has(normNum)) {
      const initialZones = getTicketZones(t);
      activeMap.set(normNum, {
        ...t,
        number: normNum,
        zones: initialZones
      });
    } else {
      const existing = activeMap.get(normNum)!;
      const existingZones = getTicketZones(existing);
      const incomingZones = getTicketZones(t);

      const mergedZones = [...existingZones];
      for (const incZone of incomingZones) {
        const normIncZone = normalizeZone(incZone.zone);
        const existingIdx = mergedZones.findIndex((z) => normalizeZone(z.zone) === normIncZone);

        if (existingIdx >= 0) {
          if (incZone.status === 'pending' && mergedZones[existingIdx].status === 'completed') {
            mergedZones[existingIdx] = { ...mergedZones[existingIdx], status: 'pending' };
          }
        } else {
          mergedZones.push(incZone);
        }
      }

      const mergedStatus = existing.status === 'active' || t.status === 'active' ? 'active' : existing.status;
      const isPriority = Boolean(existing.isPriority || t.isPriority);

      activeMap.set(normNum, {
        ...existing,
        status: mergedStatus,
        isPriority,
        zones: mergedZones,
        createdAt: Math.min(existing.createdAt || Date.now(), t.createdAt || Date.now())
      });
    }
  }

  return [...Array.from(activeMap.values()), ...nonActiveTickets];
}

/**
 * Checks if all zones of a ticket are completed.
 */
export function isTicketFullyCompleted(ticket: Ticket): boolean {
  const zones = getTicketZones(ticket);
  return zones.length > 0 && zones.every((z) => z.status === 'completed');
}

/**
 * Checks if a zone exists in a ticket.
 */
export function hasZoneInTicket(ticket: Ticket, zoneName: string): boolean {
  const targetKey = getTicketZoneKey('0', zoneName);
  const zones = getTicketZones(ticket);
  return zones.some((z) => getTicketZoneKey('0', z.zone) === targetKey);
}

/**
 * Finds an active ticket with ticketNumber (waiting, pending, active, missing).
 */
export function findActiveTicketByNumber(tickets: Ticket[], ticketNumber: string): Ticket | undefined {
  const normNum = formatTicketNumber(ticketNumber);
  return tickets.find((t) => {
    if (!isActiveTicket(t)) return false;
    const tNorm = formatTicketNumber(t.number);
    return tNorm === normNum || String(t.number).trim() === String(ticketNumber).trim();
  });
}

/**
 * AUTOMATED MANDATORY TEST FOR DUPLICATE LOGIC (Requirement 15)
 * Test sequence:
 * 1. 504 / cocina -> EXPECT: ACCEPTED
 * 2. 504 / cocina -> EXPECT: REJECTED (duplicate_same_zone)
 * 3. 504 / linea  -> EXPECT: ACCEPTED
 * 4. 504 / linea  -> EXPECT: REJECTED (duplicate_same_zone)
 * Final state: Ticket #504 has 2 zones (cocina, linea)
 */
export function runMultiZoneDuplicateTest(): { success: boolean; log: string[] } {
  const logs: string[] = [];
  let testTickets: Ticket[] = [];

  const processInput = (num: string, zoneStr: string): { accepted: boolean; reason?: string } => {
    const isDup = isDuplicateTicket(testTickets, num, zoneStr);
    const key = getTicketZoneKey(num, zoneStr);

    if (isDup) {
      logs.push(`[TEST] ${num} / ${zoneStr} -> REJECTED (Key: ${key}, Reason: duplicate_same_zone)`);
      return { accepted: false, reason: 'duplicate_same_zone' };
    }

    // Add or merge
    const normNum = String(parseInt(num, 10) || num).trim();
    const activeTicket = testTickets.find(
      (t) => String(parseInt(t.number, 10) || t.number).trim() === normNum &&
             (t.status === 'waiting' || t.status === 'active' || t.status === 'pending')
    );

    const newZoneObj = {
      id: `${normNum}:${normalizeZone(zoneStr)}`,
      zone: zoneStr,
      status: 'pending' as const,
      createdAt: Date.now()
    };

    if (activeTicket) {
      const currentZones = getTicketZones(activeTicket);
      const updatedTicket: Ticket = {
        ...activeTicket,
        zones: [...currentZones, newZoneObj]
      };
      testTickets = testTickets.map((t) => (t.id === activeTicket.id ? updatedTicket : t));
    } else {
      const newTicket: Ticket = {
        id: `test-${Date.now()}-${Math.random()}`,
        number: normNum,
        createdAt: Date.now(),
        status: 'waiting',
        createdByDevice: 'HIOPOS-TEST',
        source: 'HIOPOS',
        zones: [newZoneObj],
        zone: zoneStr
      };
      testTickets.push(newTicket);
    }

    logs.push(`[TEST] ${num} / ${zoneStr} -> ACCEPTED (Key: ${key})`);
    return { accepted: true };
  };

  // Step 1: 504 / cocina
  const step1 = processInput('504', 'cocina');
  // Step 2: 504 / cocina
  const step2 = processInput('504', 'cocina');
  // Step 3: 504 / linea
  const step3 = processInput('504', 'linea');
  // Step 4: 504 / linea
  const step4 = processInput('504', 'linea');

  const ticket504 = testTickets.find(t => t.number === '504');
  const zones504 = ticket504 ? getTicketZones(ticket504) : [];

  const passed =
    step1.accepted === true &&
    step2.accepted === false && step2.reason === 'duplicate_same_zone' &&
    step3.accepted === true &&
    step4.accepted === false && step4.reason === 'duplicate_same_zone' &&
    zones504.length === 2;

  if (passed) {
    logs.push(`✅ [TEST PASSED] Ticket #504 creado con 2 zonas (Cocina y Línea) sin duplicados erroneos.`);
  } else {
    logs.push(`❌ [TEST FAILED] Inconsistencia detectada en la prueba automatizada.`);
  }

  return { success: passed, log: logs };
}
