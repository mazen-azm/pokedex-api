# pokedex-api

A small Pokémon API in Node.js and Express, built for week 3 of the AZM Squad
programme. It serves the Android Pokédex client I built in weeks 1–2.

I am a Senior Flutter developer. Weeks 1–2 were the client — Kotlin and Jetpack
Compose, consuming an API. This week is the other side of the same wire: writing the
thing that answers.

## The Android client, running on this API

| List | Detail |
|---|---|
| <img src="docs/screenshots/android-list-from-this-api.png" width="240"> | <img src="docs/screenshots/android-detail-from-this-api.png" width="240"> |

Every row on those screens came from this server. Charizard reads 1.7 m and 90.5 kg
because the API sends 17 decimetres and 905 hectograms and the client converts them —
the units are the contract, not an oversight.

Client repo: [MyFirstNativeApp](https://github.com/mazen-azm/MyFirstNativeApp)

---

## Running it

```bash
npm install
```

```bash
npm start
```

Listens on `http://localhost:3000`. Use `npm run dev` to restart on file changes.

---

## Endpoints

```
GET /api/health
GET /api/pokemon?limit=20&offset=0
GET /api/pokemon/:idOrName
```

`:idOrName` accepts either — `/api/pokemon/25` and `/api/pokemon/pikachu` return the
same thing.

```bash
curl "http://localhost:3000/api/pokemon?limit=5"
curl "http://localhost:3000/api/pokemon/charizard"
```

**Errors:** 404 for an unknown id or route, 400 for a `limit` or `offset` that is not
a whole number, or a `limit` above 100. Every error is JSON, never an HTML page — an
HTML body would fail the client's JSON parser with a message far from the real cause.

---

## The one decision worth explaining

The data is stored in one shape and published in another, on purpose.

`src/data/pokemon.json` is flat and sanely named — `heightDm`, `weightHg`, a plain
list of type names. What goes out on the wire is PokéAPI's shape instead: types nested
two levels deep, stats as `{ base_stat, stat: { name } }`, heights in decimetres.

That is not an accident of laziness. The Android client already reads PokéAPI's shape,
so publishing it means the client needed **one line changed** — the base URL. How data
is stored and how it is published are two separate decisions, and keeping them separate
is what lets either side change without the other noticing.

It is the same lesson as the client's DTO / domain split in week 2, seen from the
opposite end of the connection.

### What copying PokéAPI's contract also copies

The list endpoint returns a name and a url and nothing else — no image, no types, no
stats. That is why the client still makes one request per Pokémon after fetching a
page. I could return everything in one response and cut 21 requests to 1.

I have not, yet. Keeping the contract identical is what made this week's client change
a single line. Changing it is a real improvement and a real decision, and it belongs in
a week where the client work is planned rather than smuggled in here.

---

## Connecting the Android app

`PokeApi.BASE_URL` becomes:

```kotlin
const val BASE_URL = "http://10.0.2.2:3000/api/"
```

`10.0.2.2` is how the Android emulator addresses the host machine. `localhost` from
inside the emulator means the emulator itself.

Android also blocks plain HTTP by default, so the app needs a network security config
permitting cleartext to that address. Without it the app builds and installs fine and
every request fails at runtime.

The server binds to `0.0.0.0` rather than `localhost` for the same reason — a
localhost-only bind refuses the emulator's connection.

---

## Project layout

```
src/
├── server.js           express app, request logging, 404 handler
├── routes/pokemon.js   the endpoints, and the reshaping into PokéAPI's format
└── data/pokemon.json   30 Pokémon — the storage shape
```

---

## Coming in week 4

The JSON file becomes a SQLite database. The test is that **the Android client needs no
change at all** when it does — the same architectural check as week 2, run again a
layer further down.
