# Incremunica Trainbench

TypeScript implementation of the [Train Benchmark](https://github.com/ftsrg/trainbenchmark) for incremental SPARQL query engines.

The benchmark runs query/transform cycles on a railway RDF model and records query latency, memory use, and incremental result changes (additions/deletions).

## Prerequisites

- Node.js + npm
- A local checkout of `incremunica` next to this repository (this project uses `file:../incremunica/...` dependencies in `package.json`)

## Install and build

```bash
npm install
npm run build
```

## Run the benchmark

1. Create a local benchmark config JSON (see example below).
2. Run:

```bash
node bin/index.js -f data/benchmarkConfigs/config-local.json
```

The `-f` argument is required.

## Example benchmark config

The repository contains `data/benchmarkConfigs/config-complete.json`, but it uses machine-specific absolute paths. Create your own config file with local paths.

```json
{
  "commonConfig": {
    "randomSeed": "incremunica",
    "baseResultPath": "results/resultsData/",
    "baseConfigPath": "results/benchmarkConfigs/",
    "baseIncremunicaConfigPath": "data/configs/"
  },
  "benchmarkConfigs": [
    {
      "matchTransformPercentage": 30,
      "joinAlgorithm": ["full-hash-join"],
      "dataPath": ["data/models/railway-batch-1-inferred.ttl"],
      "operationStrings": [
        ["BatchConnectedSegments", "InjectConnectedSegments", "RepairConnectedSegments"]
      ],
      "numberOfTransforms": 2,
      "numberOfRuns": 1
    }
  ]
}
```

## Config fields

### `commonConfig`

- `randomSeed`: random seed used for selecting transformation matches.
- `baseResultPath`: directory where CSV result files are written.
- `baseConfigPath`: directory where generated expanded benchmark configs are written.
- `baseIncremunicaConfigPath`: directory containing join algorithm config folders (`<name>/engine.js`).

### `benchmarkConfigs[]`

- `joinAlgorithm`: one or more algorithm names. Supported out of the box:
  - `computational-bind-join`
  - `delta-query`
  - `full-hash-join`
  - `memory-bind-join`
  - `nestedloop-join`
  - `partial-match-hash-join`
  - `partial-delete-hash-join`
- `dataPath`: one or more RDF model files.
- `operationStrings`: one operation chain or a list of operation chains.
- `numberOfTransforms`: number of transform/recheck rounds per run.
- `numberOfRuns`: number of measured runs (a warm-up run happens before these).
- `matchTransformPercentage` or `matchTransformAmount`: how many matches are transformed per round.

## Output

- CSV files are created in `commonConfig.baseResultPath`.
- Expanded per-run configs are written to `commonConfig.baseConfigPath`.
- Cache files are written to `data/cachedResults/` (derived from `baseIncremunicaConfigPath`).

## Using your own browser-based incremental SPARQL engine

This benchmark runs in Node.js workers, so a browser-based engine needs a Node-facing adapter.

### 1) Modify `lib/Driver.ts`

Replace the current engine construction:

```ts
const queryEngine = new QueryEngineBase(require(config.queryEngineConfig));
```

with your own adapter instance (or factory) that exposes:

- `queryBindings(queryString, { sources })`

You will also need to decide what to use for `transformationQueryEngine`:

- same engine adapter as `queryEngine`, or
- a separate engine dedicated to transformation operations.

`Driver` currently creates a `StreamingStore` from a Turtle file. If your engine requires a different source/store type, change this creation step accordingly and keep `driver.streamingStore` compatible with the operations listed below.

### 2) Modify `lib/operations/Operation.ts`

There are two important integration points:

- Store cloning in the constructor:
  - currently hardcoded to `new StreamingStore<Quad>()`.
  - replace this with your store/adapter type if needed.
- Incremental result consumption in `query()`:
  - assumes the bindings stream supports Node readable semantics (`readable` event + `.read()`).
  - assumes each binding has `binding.diff` where `true` means deletion and `false`/missing means addition.

If your engine emits a different change format, normalize it here before the `changeBindingsMap` logic.

`getResults()` currently uses `@comunica/query-sparql-rdfjs` as a non-incremental reference engine for cached baseline results. If that does not work with your store/source type, replace this part with your own baseline evaluator.

### 3) Required store interface

The benchmark logic expects these methods/properties on the store used by `Driver` and `Operation`:

- `addQuad(quad)`
- `removeQuad(quad)`
- `match(...)` returning a readable quad stream (`data`/`end`)
- `import(quadStream)`
- `halt()`
- `resume()`
- `flush()`
- `isHalted()`
- `getStore()` returning an object that:
  - is iterable (`for (const quad of getStore())`)
  - supports `match(...)`
  - supports `getQuads(subject, predicate, object, graph)`

### 4) Other files you may need to change

- `bin/index.ts`: add your engine name in `getJoinConfigPath()` if you still want to configure engines via `joinAlgorithm`.
- `lib/Driver.ts` and `lib/operations/Operation.ts`: relax Incremunica-specific TypeScript types to local interfaces if your adapter uses different runtime types.
- `lib/operations/inject/*` and `lib/operations/repair/*`: update if your store needs quads in a different concrete representation.
