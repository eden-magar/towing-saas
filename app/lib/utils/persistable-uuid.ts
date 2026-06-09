/** RFC 4122 UUID v4 — only these may be written to Postgres uuid PK columns. */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Use a client-provided id for DB insert only when it is a real UUID v4.
 * Route-builder temp ids (vehicle_*, point_*) must not be persisted as PKs.
 */
export function persistableUuid(id?: string | null): string {
  if (id && UUID_V4_REGEX.test(id)) {
    return id
  }
  return crypto.randomUUID()
}
