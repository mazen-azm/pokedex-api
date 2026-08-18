import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { openDatabase } from '../db/database.js'
import { seed } from '../db/seed.js'
import { createPokemonRepository } from './pokemonRepository.js'

/**
 * Runs against a real SQLite database that lives in memory and disappears when
 * the process ends. ':memory:' is not a mock — it is the same engine running the
 * same SQL, so a query that works here works against the file.
 *
 * This is what the injected database bought: no fixture file, no cleanup, no
 * flag, and no chance of a test writing to the database the server is serving.
 */
const db = openDatabase(':memory:')
seed(db)
const repo = createPokemonRepository(db)

describe('page', () => {
  test('returns the requested slice, ordered by id', () => {
    assert.deepEqual(
      repo.page({ limit: 3, offset: 0 }).map((p) => p.name),
      ['bulbasaur', 'ivysaur', 'venusaur'],
    )
    assert.deepEqual(repo.page({ limit: 2, offset: 3 }).map((p) => p.id), [4, 5])
  })

  test('an offset past the end returns nothing rather than failing', () => {
    assert.deepEqual(repo.page({ limit: 10, offset: 9999 }), [])
  })
})

describe('findByIdOrName', () => {
  test('finds by id, whether it arrives as a number or as a string', () => {
    assert.equal(repo.findByIdOrName(25).name, 'pikachu')
    assert.equal(repo.findByIdOrName('25').name, 'pikachu')
  })

  test('finds by name, case-insensitively', () => {
    assert.equal(repo.findByIdOrName('pikachu').id, 25)
    assert.equal(repo.findByIdOrName('CHARIZARD').id, 6)
  })

  test('returns null rather than throwing when nothing matches', () => {
    assert.equal(repo.findByIdOrName(9999), null)
    assert.equal(repo.findByIdOrName('missingno'), null)
  })

  test('keeps type order, which rows do not have on their own', () => {
    // The bug this catches is silent: charizard still has both types, in the
    // wrong order, and the client colours the card by the first one.
    assert.deepEqual(repo.findByIdOrName(6).types, ['fire', 'flying'])
  })

  test('keeps stat order, and every Pokémon has all six', () => {
    for (let id = 1; id <= repo.count(); id++) {
      assert.deepEqual(Object.keys(repo.findByIdOrName(id).stats), [
        'hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed',
      ], `id ${id}`)
    }
  })
})

describe('the database itself', () => {
  test('rejects a child row pointing at a Pokémon that does not exist', () => {
    // Proves PRAGMA foreign_keys is actually on. Without it SQLite accepts this
    // insert quietly and the schema's REFERENCES means nothing.
    assert.throws(() =>
      db.prepare('INSERT INTO pokemon_types VALUES (?, ?, ?)').run(9999, 1, 'ghost'),
    )
  })

  test('seeding twice leaves one copy, not two', () => {
    const twice = openDatabase(':memory:')
    seed(twice)
    assert.equal(seed(twice), createPokemonRepository(twice).count())
    assert.equal(createPokemonRepository(twice).count(), repo.count())
  })
})
