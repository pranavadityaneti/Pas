// TODO(TECH DEBT): Proper fix requires migrating timestamp columns 
// (e.g. created_at) from "timestamp without time zone" to "timestamptz" in Prisma/Postgres.
export function parseUtc(ts: string | Date | undefined): Date {
    if (!ts) return new Date();
    if (typeof ts === 'string' && !ts.endsWith('Z') && !ts.includes('+')) {
        return new Date(ts + 'Z');
    }
    return new Date(ts);
}
