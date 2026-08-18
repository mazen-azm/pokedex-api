import { readFileSync } from 'node:fs'

/**
 * Everything that decides *what* to answer, with no knowledge of HTTP.
 *
 * Nothing here touches `req` or `res`, sets a status code, or knows Express
 * exists. That is the whole point: this file is testable without starting a
 * server, the same way the Android app's mapper and repository were testable
 * without an emulator.
 *
 * The route above it stays thin — it reads the request, calls one of these, and
 * turns the result into a status code.
 */

const pokemon = JSON.parse(
  readFileSync(new URL('../data/pokemon.json', import.meta.url), 'utf8'),
)

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

const ARTWORK =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/** Total records available. Exposed so tests do not hardcode 30. */
export const pokemonCount = pokemon.length

/**
 * Validates `?limit=&offset=` and applies the defaults.
 *
 * Returns a result object rather than throwing, so the caller decides what a bad
 * value means — here a 400, but a CLI would want something else. Same reasoning
 * as the repository returning Result<T> instead of letting exceptions escape.
 */
export function parsePagination({ limit, offset } = {}) {
  const parsed = { limit: DEFAULT_LIMIT, offset: 0 }

  for (const [key, raw] of [['limit', limit], ['offset', offset]]) {
    if (raw === undefined) continue
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 0) {
      return { ok: false, error: 'limit and offset must be whole numbers of 0 or more' }
    }
    parsed[key] = value
  }

  if (parsed.limit > MAX_LIMIT) {
    return { ok: false, error: `limit cannot exceed ${MAX_LIMIT}` }
  }

  return { ok: true, ...parsed }
}

/**
 * One page, in the shape PokemonListResponseDto expects.
 *
 * `url` must end with the id: the Android client extracts it from there rather
 * than making a request per item just to learn it.
 */
export function listPokemon({ limit, offset, baseUrl }) {
  const page = pokemon.slice(offset, offset + limit)

  // One place that knows what a page link looks like. next and previous differ
  // only by their offset, so writing the template twice would mean remembering
  // to change both if the route ever moves.
  const pageUrl = (at) => `${baseUrl}/pokemon?limit=${limit}&offset=${at}`

  return {
    count: pokemon.length,
    next: offset + limit < pokemon.length ? pageUrl(offset + limit) : null,
    previous: offset > 0 ? pageUrl(Math.max(0, offset - limit)) : null,
    results: page.map((p) => ({
      name: p.name,
      url: `${baseUrl}/pokemon/${p.id}/`,
    })),
  }
}

/** By id or by name, case-insensitive. Returns null rather than throwing. */
export function findPokemon(idOrName) {
  const key = String(idOrName).toLowerCase()
  return pokemon.find((p) => String(p.id) === key || p.name === key) ?? null
}

/**
 * The stored record, reshaped into what PokemonDetailDto expects.
 *
 * Height and weight pass through untouched, in decimetres and hectograms. They
 * look wrong and they are correct: that is the contract the client's mapper was
 * written against, and it converts them to metres and kilograms on the far side.
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
