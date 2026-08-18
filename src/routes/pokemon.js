import { Router } from 'express'
import {
  findPokemon,
  listPokemon,
  parsePagination,
  toDetailResponse,
} from '../services/pokemonService.js'

/**
 * The HTTP layer, and only the HTTP layer.
 *
 * Each handler does three things: read the request, call the service, turn the
 * result into a status code. No data shaping, no filtering, no business rules —
 * those live in the service, where they can be tested without a server.
 *
 * Android map: this file is the ViewModel, the service is the repository.
 */
const router = Router()

/** Absolute URLs, because the client reads the id off the end of one. */
const baseUrl = (req) => `${req.protocol}://${req.get('host')}/api`

router.get('/pokemon', (req, res) => {
  const page = parsePagination(req.query)
  if (!page.ok) {
    return res.status(400).json({ error: page.error })
  }

  res.json(listPokemon({ limit: page.limit, offset: page.offset, baseUrl: baseUrl(req) }))
})

router.get('/pokemon/:idOrName', (req, res) => {
  const found = findPokemon(req.params.idOrName)
  if (!found) {
    return res.status(404).json({ error: `No Pokémon matching '${req.params.idOrName}'` })
  }

  res.json(toDetailResponse(found, baseUrl(req)))
})

export default router
