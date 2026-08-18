import express from 'express'

/**
 * The whole server, for now.
 *
 * Flutter/Android map:
 *   express()            ≈ the Retrofit interface, but from the answering side
 *   app.get('/path', fn) ≈ @GET("path") — except here you write what *responds*
 *   res.json(...)        ≈ returning a DTO that Moshi would later parse
 *
 * `req` is the incoming request, `res` is the reply you build.
 */
const app = express()

const PORT = process.env.PORT ?? 3000

// A health route: something to hit before any real work exists, so "is the
// server up?" is never confused with "is my endpoint wrong?".
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 0.0.0.0, not localhost: the Android emulator reaches the host machine at
// 10.0.2.2, and a server bound only to localhost would refuse that connection.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`pokedex-api listening on http://localhost:${PORT}`)
})
