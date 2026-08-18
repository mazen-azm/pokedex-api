/**
 * The only file that writes SQL.
 *
 * The rule the repo already had — mentions `req` or `res` → route, does not →
 * service — gains a second half: writes SQL → repository. Nothing above this file
 * knows there is a database, which is the same reason the Android app's ViewModel
 * cannot tell whether a Pokémon came from Retrofit or from a hardcoded list.
 *
 * It is a factory, not a module of functions, for one reason: the database comes
 * in as an argument. That is what lets the tests run against an in-memory
 * database while the server runs against a file, without a flag or a mock.
 */
export function createPokemonRepository(db) {
  // Prepared once, here, rather than on every request. `prepare` is where SQLite
  // parses the SQL and plans the query; running it after that is just binding
  // values. Android map: the compiled statements Room generates from a @Dao.
  const countAll = db.prepare('SELECT COUNT(*) AS n FROM pokemon')

  // ORDER BY id is not decoration. Without it SQLite may return rows in any
  // order it finds convenient, and "page 2" would stop meaning anything.
  const selectPage = db.prepare(
    'SELECT id, name FROM pokemon ORDER BY id LIMIT ? OFFSET ?',
  )

  // ?1 twice: one value, compared against both columns. An id arrives as the
  // string "25" and a name as "pikachu"; SQLite compares each against the column
  // it can, so the name never accidentally matches an id.
  const selectOne = db.prepare(
    'SELECT id, name, height_dm, weight_hg FROM pokemon WHERE id = ?1 OR name = ?1',
  )

  const selectTypes = db.prepare(
    'SELECT name FROM pokemon_types WHERE pokemon_id = ? ORDER BY slot',
  )
  const selectStats = db.prepare(
    'SELECT name, base_stat FROM pokemon_stats WHERE pokemon_id = ? ORDER BY ordinal',
  )

  return {
    count: () => countAll.get().n,

    /** Ids and names only — a list row needs nothing else. */
    page: ({ limit, offset }) => selectPage.all(limit, offset),

    /**
     * One Pokémon, in the shape the service already expected from the JSON file:
     * types as an ordered array, stats as an ordered object. The reshaping into
     * the API's response happens a layer up and did not have to change.
     *
     * Three queries rather than one join, on purpose. Joining a row to its two
     * types *and* its six stats multiplies them together — twelve rows carrying
     * the same Pokémon, to be de-duplicated in JavaScript afterwards. Two extra
     * lookups by primary key cost less than that and read better.
     */
    findByIdOrName: (idOrName) => {
      const row = selectOne.get(String(idOrName).toLowerCase())
      if (!row) return null

      return {
        id: row.id,
        name: row.name,
        heightDm: row.height_dm,
        weightHg: row.weight_hg,
        types: selectTypes.all(row.id).map((t) => t.name),
        stats: Object.fromEntries(selectStats.all(row.id).map((s) => [s.name, s.base_stat])),
      }
    },
  }
}
