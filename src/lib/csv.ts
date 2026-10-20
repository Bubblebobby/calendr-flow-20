/**
 * One CSV cell: quoted, with quotes doubled. Text that a spreadsheet would run as a formula
 * (starting with = + - @, tab or carriage return) gets a leading ' so it opens as plain text.
 * Plain numbers such as "-500" are left alone.
 */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
