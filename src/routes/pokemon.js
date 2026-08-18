import { Router } from 'express'
import { readFileSync } from 'node:fs'

/**
 * The Pokémon endpoints.
 *
 * The file in src/data holds the data in a shape that is convenient for *us*:
 * flat, sane names, one object per Pokémon. What goes out on the wire is a
 * different shape — the one PokéAPI uses, which the Android client already knows
 * how to read.
 *
 * That gap is deliberate, and it is the same lesson as week 2's DTO / domain
 * split, seen from the other side: how you store data and how you publish it are
 * two decisions, not one. Changing the storage should not change the contract.
 */

const pokemon = JSON.parse(
  readFileSync(new URL('../data/pokemon.json', import.meta.url), 'utf8'),
)

const router = Router()

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const ARTWORK =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/** Absolute URLs, because the client extracts the id from the end of one. */
const baseUrl = (req) => `${req.protocol}://${req.get('host')}/api`

/**
 * Reads a query parameter that must be a non-negative whole number.
 * Returns null when it is present but nonsense, so the caller can answer 400
 * instead of silently treating "abc" as 0.
 */
function readIntParam(raw, fallback) {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return null
  return value
}

/**
 * GET /api/pokemon?limit=20&offset=0
 *
 * Shape matches PokemonListResponseDto: count, next, previous, results[{name,url}].
 * Note what is *not* here: no image, no types, no stats — exactly the limitation
 * that forced the client into a second request per Pokémon. Copying it on purpose
 * keeps the client working unchanged; fixing it is a later decision, made
 * knowingly rather than by accident.
 */
router.get('/pokemon', (req, res) => {
  const limit = readIntParam(req.query.limit, DEFAULT_LIMIT)
  const offset = readIntParam(req.query.offset, 0)

  if (limit === null || offset === null) {
    return res.status(400).json({
      error: 'limit and offset must be whole numbers of 0 or more',
    })
  }
  if (limit > MAX_LIMIT) {
    return res.status(400).json({ error: `limit cannot exceed ${MAX_LIMIT}` })
  }

  const page = pokemon.slice(offset, offset + limit)
  const base = baseUrl(req)

  res.json({
    count: pokemon.length,
    next:
      offset + limit < pokemon.length
        ? `${base}/pokemon?limit=${limit}&offset=${offset + limit}`
        : null,
    previous:
      offset > 0
        ? `${base}/pokemon?limit=${limit}&offset=${Math.max(0, offset - limit)}`
        : null,
    results: page.map((p) => ({
      name: p.name,
      url: `${base}/pokemon/${p.id}/`,
    })),
  })
})

/**
 * GET /api/pokemon/:idOrName
 *
 * Shape matches PokemonDetailDto. Height and weight stay in decimetres and
 * hectograms — the units PokéAPI uses and the client's mapper already converts.
 * Sending kilograms here would be tidier and would break the client, which is
 * the whole point of a contract.
 */
router.get('/pokemon/:idOrName', (req, res) => {
  const key = req.params.idOrName.toLowerCase()
  const found = pokemon.find(
    (p) => String(p.id) === key || p.name === key,
  )

  if (!found) {
    return res.status(404).json({ error: `No Pokémon matching '${key}'` })
  }

  const base = baseUrl(req)

  res.json({
    id: found.id,
    name: found.name,
    height: found.heightDm,
    weight: found.weightHg,
    types: found.types.map((name, index) => ({
      slot: index + 1,
      type: { name, url: `${base}/type/${name}/` },
    })),
    stats: Object.entries(found.stats).map(([name, value]) => ({
      base_stat: value,
      effort: 0,
      stat: { name, url: `${base}/stat/${name}/` },
    })),
    sprites: {
      other: {
        'official-artwork': { front_default: `${ARTWORK}/${found.id}.png` },
      },
    },
  })
})

export default router
