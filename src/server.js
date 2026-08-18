import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import pokemonRoutes from './routes/pokemon.js'

/**
 * The server: what runs on every request, in the order it runs.
 *
 * Android map:
 *   app.use(fn)          ≈ an OkHttp interceptor — runs on every request
 *   app.get('/x', fn)    ≈ @GET("x"), but writing what *responds*
 *   res.json(...)        ≈ the DTO Moshi parses on the far end
 */
const app = express()

const PORT = process.env.PORT ?? 3000

/**
 * Security headers. One line, and the browser stops guessing.
 *
 * It sets things like nosniff (do not second-guess the content type) and
 * frameguard (do not let another site embed this in an iframe). None of it
 * matters to the Android client, which is not a browser — it matters the moment
 * anything with a URL bar talks to this API.
 */
app.use(helmet())

/**
 * Cross-Origin Resource Sharing.
 *
 * A browser refuses to let a page on one origin read a response from another
 * unless the response says it is allowed. This header is that permission.
 *
 * The Android app has never needed it — apps are not subject to the rule. This is
 * here for the browser client that does not exist yet, and it is open to all
 * origins because there is nothing private to protect. A real API would name the
 * origins it trusts.
 */
app.use(cors())

/**
 * Request log. The server-side twin of the OkHttp logging interceptor, and what
 * turns "it doesn't work" into a line you can read.
 *
 * `next()` hands control to whatever comes after. Forget it and the request hangs
 * here forever.
 */
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

/** Nothing matched. JSON, not Express's HTML page, which would break the client's parser. */
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
})

/**
 * The last line of defence: anything a route threw and did not handle.
 *
 * Express recognises this as an error handler by its **four** parameters, not by
 * its position or its name. Drop `next` and it silently becomes ordinary
 * middleware that never runs.
 *
 * Without it an unexpected throw returns an HTML stack trace — leaking file paths
 * in production, and failing the client's JSON parser with a message that points
 * nowhere near the real cause.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err)
  res.status(500).json({ error: 'Something went wrong on our side' })
})

// 0.0.0.0, not localhost: the Android emulator reaches the host at 10.0.2.2, and a
// localhost-only bind refuses that connection.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`pokedex-api listening on http://localhost:${PORT}`)
})
