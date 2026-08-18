import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { openDatabase } from '../db/database.js'
import { seed } from '../db/seed.js'
import { createPokemonRepository } from '../repositories/pokemonRepository.js'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  createPokemonService,
  parsePagination,
  toDetailResponse,
} from './pokemonService.js'

/**
 * Runs with Node's built-in test runner — `npm test`. No test framework
 * installed, no server started, no network, and now no database file either:
 * ':memory:' is a real SQLite database that never touches the disk.
 *
 * These mirror the Android project's PokemonMapperTest: the reshaping is where
 * silent bugs live, because a wrong unit or a mis-ordered type produces a screen
 * that looks completely normal and is wrong.
 *
 * Every assertion below is the one that was here when the data came from a JSON
 * file. Only the three lines of setup are new — which is the point of the week.
 */

const db = openDatabase(':memory:')
seed(db)
const service = createPokemonService(createPokemonRepository(db))

const pokemonCount = service.count()
const { findPokemon, listPokemon } = service

const BASE = 'http://localhost:3000/api'

describe('parsePagination', () => {
  test('applies defaults when nothing is given', () => {
    assert.deepEqual(parsePagination({}), { ok: true, limit: DEFAULT_LIMIT, offset: 0 })
  })

  test('accepts valid numbers', () => {
    assert.deepEqual(parsePagination({ limit: '5', offset: '10' }), {
      ok: true, limit: 5, offset: 10,
    })
  })

  test('rejects text, decimals and negatives instead of coercing them', () => {
    for (const bad of [{ limit: 'abc' }, { limit: '1.5' }, { limit: '-5' }, { offset: '-1' }]) {
      assert.equal(parsePagination(bad).ok, false, `${JSON.stringify(bad)} should be rejected`)
    }
  })

  test('rejects a limit above the maximum', () => {
    assert.equal(parsePagination({ limit: String(MAX_LIMIT + 1) }).ok, false)
    assert.equal(parsePagination({ limit: String(MAX_LIMIT) }).ok, true)
  })
})

describe('listPokemon', () => {
  test('returns the requested slice and the total count', () => {
    const page = listPokemon({ limit: 3, offset: 0, baseUrl: BASE })
    assert.equal(page.count, pokemonCount)
    assert.equal(page.results.length, 3)
    assert.deepEqual(page.results.map((r) => r.name), ['bulbasaur', 'ivysaur', 'venusaur'])
  })

  test('previous is null on the first page, next is null on the last', () => {
    const first = listPokemon({ limit: 10, offset: 0, baseUrl: BASE })
    assert.equal(first.previous, null)
    assert.notEqual(first.next, null)

    const last = listPokemon({ limit: 10, offset: pokemonCount - 5, baseUrl: BASE })
    assert.equal(last.next, null)
    assert.notEqual(last.previous, null)
  })

  test('an offset past the end returns no results rather than failing', () => {
    const page = listPokemon({ limit: 10, offset: 9999, baseUrl: BASE })
    assert.deepEqual(page.results, [])
    assert.equal(page.count, pokemonCount)
  })

  test('each url ends with the id, because the client parses it from there', () => {
    const page = listPokemon({ limit: 1, offset: 24, baseUrl: BASE })
    assert.equal(page.results[0].url, `${BASE}/pokemon/25/`)
    // The client does url.trimEnd('/').substringAfterLast('/') — reproduce it.
    const id = Number(page.results[0].url.replace(/\/$/, '').split('/').pop())
    assert.equal(id, 25)
  })
})

describe('findPokemon', () => {
  test('finds by id and by name', () => {
    assert.equal(findPokemon(25).name, 'pikachu')
    assert.equal(findPokemon('25').name, 'pikachu')
    assert.equal(findPokemon('pikachu').id, 25)
  })

  test('is case-insensitive', () => {
    assert.equal(findPokemon('Pikachu').id, 25)
    assert.equal(findPokemon('CHARIZARD').id, 6)
  })

  test('returns null rather than throwing when nothing matches', () => {
    assert.equal(findPokemon(9999), null)
    assert.equal(findPokemon('missingno'), null)
  })
})

describe('toDetailResponse', () => {
  const pikachu = toDetailResponse(findPokemon(25), BASE)

  test('keeps the API units — decimetres and hectograms', () => {
    // 4 dm and 60 hg. The client's mapper divides by 10 to get 0.4 m / 6.0 kg,
    // which is what the week 1 hardcoded data independently says.
    assert.equal(pikachu.height, 4)
    assert.equal(pikachu.weight, 60)
  })

  test('nests types with a 1-based slot, in order', () => {
    const charizard = toDetailResponse(findPokemon(6), BASE)
    assert.deepEqual(
      charizard.types.map((t) => [t.slot, t.type.name]),
      [[1, 'fire'], [2, 'flying']],
    )
  })

  test('publishes stats as base_stat with a nested name', () => {
    const hp = pikachu.stats.find((s) => s.stat.name === 'hp')
    assert.equal(hp.base_stat, 35)
    assert.deepEqual(
      pikachu.stats.map((s) => s.stat.name),
      ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'],
    )
  })

  test('builds the artwork url from the id', () => {
    assert.ok(pikachu.sprites.other['official-artwork'].front_default.endsWith('/25.png'))
  })

  test('every record can be reshaped without throwing', () => {
    for (let id = 1; id <= pokemonCount; id++) {
      const record = findPokemon(id)
      assert.ok(record, `missing id ${id}`)
      const detail = toDetailResponse(record, BASE)
      assert.ok(detail.types.length >= 1, `${record.name} has no type`)
      assert.equal(detail.stats.length, 6, `${record.name} does not have six stats`)
    }
  })
})
