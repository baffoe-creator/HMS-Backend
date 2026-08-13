/**
 * With `dateStrings: true` on the MySQL connection, DATETIME/DATE columns
 * come back as plain strings like '2026-09-01 09:00:00' - no 'T', no 'Z',
 * no timezone marker at all. Every datetime this app writes originates from
 * a UTC-instant Date (see appointment.repository.create), so on the way
 * back out we can safely treat that string as UTC - but only if we say so
 * explicitly. Handing '2026-09-01 09:00:00' to `new Date(...)` directly is
 * unsafe: Node parses a string with no timezone marker as *local* time, so
 * behavior would silently depend on the server's TZ setting.
 */
export function mysqlDatetimeToIsoUtc(mysqlDatetime: string): string {
  const isoLike = mysqlDatetime.replace(' ', 'T');
  const withZ = isoLike.endsWith('Z') ? isoLike : `${isoLike}Z`;
  return new Date(withZ).toISOString();
}
