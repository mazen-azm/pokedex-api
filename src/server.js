import express from 'express'
import pokemonRoutes from './routes/pokemon.js'

/**
 * The server.
 *
 * Flutter/Android map:
 *   express()            ≈ the Retrofit interface, but from the answering side
 *   app.get('/path', fn) ≈ @GET("path") — except here you write what *responds*
 *   res.json(...)        ≈ the DTO Moshi parses on the other end
 *   app.use(fn)          ≈ an OkHttp interceptor: runs on every request
 */
const app = express()

const PORT = process.env.PORT ?? 3000

// Log every request. This is the server-side twin of the OkHttp logging
// interceptor from week 2 — and it is what turns "it doesn't work" into a
// specific line you can read.
app.use((req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`)
  })
  next()
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', pokemonRoutes)

// Anything that matched no route above. Without this, Express replies with an
// HTML error page, and the client's JSON parser fails on it with a confusing
// message far from the real cause.
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
})

// 0.0.0.0, not localhost: the Android emulator reaches the host machine at
// 10.0.2.2, and a server bound only to localhost would refuse that connection.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`pokedex-api listening on http://localhost:${PORT}`)
})
