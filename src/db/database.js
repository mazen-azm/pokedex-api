import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Opening a database, and nothing else.
 *
 * `node:sqlite` ships with Node itself — no dependency, no native module to
 * compile. Its API is synchronous, which looks wrong next to everything else in
 * Node until you remember what SQLite is: not a server on the far end of a
 * socket, but a file this process reads directly. There is nothing to await.
 *
 * Android map: this is the Room database instance. Nothing above it knows the
 * file exists.
 */

/** The file the server uses. Tests never touch it — they pass ':memory:'. */
export const DEFAULT_DB_PATH = join(import.meta.dirname, '..', '..', 'pokedex.db')

const SCHEMA = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')

export function openDatabase(path = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH) {
  const db = new DatabaseSync(path)

  // Off by default in SQLite, for compatibility with databases older than the
  // feature. Without it, REFERENCES in the schema is documentation rather than a
  // rule, and a stat row can point at a Pokémon that was deleted.
  db.exec('PRAGMA foreign_keys = ON')

  return db
}

/** Drops and recreates every table. Destructive on purpose — see schema.sql. */
export function applySchema(db) {
  db.exec(SCHEMA)
}
