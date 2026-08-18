import { z } from 'zod'

/**
 * Everything that decides *what* to answer, with no knowledge of HTTP and now no
 * knowledge of storage either.
 *
 * Nothing here touches `req` or `res`, and nothing here writes SQL. When the data
 * moved from a JSON file into SQLite, this is what changed in this file: two
 * functions stopped reading a module-level array and started asking a repository.
 * The reshaping below did not change at all, because the contract did not.
 *
 * The file used to open with `JSON.parse(readFileSync(...))` at module scope — a
 * hidden global that every function and every test quietly depended on. Passing
 * the repository in instead is the same move as the Android ViewModel taking its
 * repository as a constructor argument: it is what makes the thing testable
 * against a fake, and it is why the tests can run on an in-memory database.
 */

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

const ARTWORK =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/**
 * The shape a valid `?limit=&offset=` has.
 *
 * Written as a description instead of a series of if-statements. `coerce` is what
 * turns the string "5" that arrives in a query string into the number 5 — but only
 * if it really is a number, so "abc" is still rejected rather than becoming NaN.
 *
 * The value of a schema over hand-written checks is not this one case, it is the
 * tenth: adding a field here is one line, and it cannot be forgotten in a branch.
 *
 * It guards the database as well as the response. `LIMIT` and `OFFSET` take
 * whatever number they are given, so MAX_LIMIT is now also what stops one request
 * asking for a million rows.
 */
const wholeNumber = (name) =>
  z.coerce
    .number({ error: `${name} must be a whole number of 0 or more` })
    .int(`${name} must be a whole number of 0 or more`)
    .min(0, `${name} must be a whole number of 0 or more`)

const paginationSchema = z.object({
  limit: wholeNumber('limit').max(MAX_LIMIT, `limit cannot exceed ${MAX_LIMIT}`).default(DEFAULT_LIMIT),
  offset: wholeNumber('offset').default(0),
})

/**
 * Validates and applies defaults.
 *
 * Returns a result object rather than throwing, so the caller decides what a bad
 * value means — here a 400, but a CLI would want something else. Same reasoning as
 * the Android repository returning Result<T> instead of letting exceptions escape.
 *
 * Pure: no data, no database, so it stays a plain export rather than moving into
 * the factory below.
 */
export function parsePagination(query = {}) {
  const parsed = paginationSchema.safeParse(query)

  if (!parsed.success) {
    // zod reports every problem; the first one is enough for a user-facing message.
    // The message is already written for a person — see the schema above. zod's
    // defaults ("expected number, received NaN") describe the parser, not the
    // mistake, so every rule carries its own wording.
    return { ok: false, error: parsed.error.issues[0].message }
  }

  return { ok: true, ...parsed.data }
}

/**
 * The stored record, reshaped into what PokemonDetailDto expects.
 *
 * Height and weight pass through untouched, in decimetres and hectograms. They
 * look wrong and they are correct: that is the contract the client's mapper was
 * written against, and it converts them to metres and kilograms on the far side.
 *
 * Byte-identical to the version that read the JSON file, because the repository
 * hands back the same record shape. That is the week's test, in one function.
 */
export function toDetailResponse(record, baseUrl) {
  return {
    id: record.id,
    name: record.name,
    height: record.heightDm,
    weight: record.weightHg,
    types: record.types.map((name, index) => ({
      slot: index + 1,
      type: { name, url: `${baseUrl}/type/${name}/` },
    })),
    stats: Object.entries(record.stats).map(([name, value]) => ({
      base_stat: value,
      effort: 0,
      stat: { name, url: `${baseUrl}/stat/${name}/` },
    })),
    sprites: {
      other: { 'official-artwork': { front_default: `${ARTWORK}/${record.id}.png` } },
    },
  }
}

/** The half that needs data. `repo` is the only way it can reach any. */
export function createPokemonService(repo) {
  return {
    /** Total records available. A query now, not an array length. */
    count: () => repo.count(),

    /**
     * One page, in the shape PokemonListResponseDto expects.
     *
     * `slice` became LIMIT and OFFSET; `pokemon.length` became COUNT(*). The
     * count is a second query rather than something derived from the page,
     * because the page cannot know how many rows it did not return.
     *
     * `url` must end with the id: the Android client extracts it from there
     * rather than making a request per item just to learn it.
     */
    listPokemon: ({ limit, offset, baseUrl }) => {
      const total = repo.count()
      const page = repo.page({ limit, offset })

      // One place that knows what a page link looks like. next and previous differ
      // only by their offset, so writing the template twice would mean remembering
      // to change both if the route ever moves.
      const pageUrl = (at) => `${baseUrl}/pokemon?limit=${limit}&offset=${at}`

      return {
        count: total,
        next: offset + limit < total ? pageUrl(offset + limit) : null,
        previous: offset > 0 ? pageUrl(Math.max(0, offset - limit)) : null,
        results: page.map((p) => ({
          name: p.name,
          url: `${baseUrl}/pokemon/${p.id}/`,
        })),
      }
    },

    /** By id or by name, case-insensitive. Returns null rather than throwing. */
    findPokemon: (idOrName) => repo.findByIdOrName(idOrName),
  }
}
