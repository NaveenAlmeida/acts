/**
 * Geração de arquivo iCalendar (.ics) para "adicionar ao calendário".
 * Função pura — recebe os dados do evento e devolve o texto .ics que o
 * celular abre no app de calendário nativo (iOS Calendar, Google Agenda).
 */

export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string | null;
};

/** Date → formato UTC do iCalendar: 20260720T190000Z */
function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapa os caracteres reservados do formato iCalendar. */
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(ev: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Acts//PT-BR//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(ev.start)}`,
    `DTEND:${toIcsDate(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    ...(ev.location ? [`LOCATION:${escapeIcs(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${escapeIcs(ev.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
