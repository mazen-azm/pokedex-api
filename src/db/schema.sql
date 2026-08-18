-- The shape of the database. Applying this file gives an empty, correct schema.
--
-- Storage shape is not wire shape. The API publishes PokéAPI's response — types
-- nested two levels deep, stats as { base_stat, stat: { name } } — but storing it
-- that way would mean a JSON blob in a column and no reason to have a database at
-- all. Here the data is flat and related; the service reshapes it on the way out.

DROP TABLE IF EXISTS pokemon_stats;
DROP TABLE IF EXISTS pokemon_types;
DROP TABLE IF EXISTS pokemon;

CREATE TABLE pokemon (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL UNIQUE,
  -- Decimetres and hectograms, exactly as the API publishes them. The client
  -- divides by ten on the far side. Storing metres here would be tidier and
  -- would break the contract.
  height_dm INTEGER NOT NULL,
  weight_hg INTEGER NOT NULL
);

-- One row per type, not a comma-separated column: a Pokémon has one or two, and
-- "grass,poison" in a TEXT field is a list the database cannot search or count.
CREATE TABLE pokemon_types (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  -- Rows in a table have no order. The JSON array had one, and it mattered —
  -- charizard is fire *then* flying, and the client draws the first type's colour.
  -- Anything an array gave for free has to become a column here.
  slot       INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  PRIMARY KEY (pokemon_id, slot)
);

CREATE TABLE pokemon_stats (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  -- Same problem as slot: the six stat bars are drawn in a fixed order, and
  -- object key order in JSON was carrying that silently.
  ordinal    INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  base_stat  INTEGER NOT NULL,
  PRIMARY KEY (pokemon_id, name)
);

-- The two lookups the API actually performs: a page ordered by id (the primary
-- key already covers it) and a search by name. UNIQUE on name indexes it too, so
-- no extra index is needed yet — noted here so the absence reads as a decision.
