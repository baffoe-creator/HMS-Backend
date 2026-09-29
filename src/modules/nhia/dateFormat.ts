/**
 * The NHIA spec (§IV.4 Pattern) mandates DD/MM/YYYY for every date field in
 * both Claim XML and Feedback XML. Our DB stores dates as plain
 * 'YYYY-MM-DD' strings (dateStrings:true on the connection - see
 * src/db/connection.ts), so this is a straightforward reformat, not a
 * timezone-sensitive parse.
 */
export function toNhiaDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

export function nhiaDateToIso(nhiaDate: string | null | undefined): string | null {
  if (!nhiaDate) return null;
  const [day, month, year] = nhiaDate.split('/');
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}`;
}

export function isValidNhiaDateFormat(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}
