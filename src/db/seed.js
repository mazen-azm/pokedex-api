import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULT_DB_PATH, applySchema, openDatabase } from './database.js'

/**
 * Builds the database from `src/data/pokemon.json`.
 *
 * The JSON file stays: it is the source the data is written and reviewed in, and
 * a text file is reviewable in a diff in a way a binary database is not. The
 * database is the thing the server reads, and it is generated — which is why it
 * is gitignored and this script exists. Run it with `npm run seed`.
 */

const source = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'data', 'pokemon.json'), 'utf8'),
)

export function seed(db, records = source) {
  applySchema(db)

  // Prepared once, run 30 times. The '?' placeholders are not string formatting:
  // the value never becomes part of the SQL text, so a name containing a quote is
  // data and not syntax. This is the whole of what "SQL injection" means, and it
  // is avoided by never building a query out of a value in the first place.
  const insertPokemon = db.prepare(
    'INSERT INTO pokemon (id, name, height_dm, weight_hg) VALUES (?, ?, ?, ?)',
  )
  const insertType = db.prepare(
    'INSERT INTO pokemon_types (pokemon_id, slot, name) VALUES (?, ?, ?)',
  )
  const insertStat = db.prepare(
    'INSERT INTO pokemon_stats (pokemon_id, ordinal, name, base_stat) VALUES (?, ?, ?, ?)',
  )

  // One transaction around all of it: either the whole set lands or none of it
  // does, so a crash halfway through cannot leave a Pokémon with three of its six
  // stats. It is also far faster — SQLite otherwise commits to disk once per
  // statement, and there are over two hundred of them.
  db.exec('BEGIN')
  try {
    for (const p of records) {
      insertPokemon.run(p.id, p.name, p.heightDm, p.weightHg)

      // The array index becomes a column. Order was implicit in JSON; in a table
      // it has to be written down or it is lost.
      p.types.forEach((name, index) => insertType.run(p.id, index + 1, name))

      Object.entries(p.stats).forEach(([name, value], index) =>
        insertStat.run(p.id, index, name, value),
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return db.prepare('SELECT COUNT(*) AS n FROM pokemon').get().n
}

// Only when run directly — `node src/db/seed.js`. Imported by a test, this block
// is skipped, so importing the seeder never writes to the real database file.
if (process.argv[1] === import.meta.filename) {
  const path = process.argv[2] ?? process.env.DATABASE_PATH ?? DEFAULT_DB_PATH
  const db = openDatabase(path)
  const count = seed(db)
  db.close()
  console.log(`Seeded ${count} Pokémon into ${path}`)
}
