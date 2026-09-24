# Lessons

Corrections and hard-won debugging rules. Reviewed at the start of every session.

## Electron packaging

### electron-builder ignores your `files` list for node_modules
`build.files` does NOT control whether production `node_modules` ship.
electron-builder resolves the production dependency tree separately and
packs it regardless. Listing only `["dist/**/*", "electron/**/*"]` does
not exclude anything.

**Rule:** if nothing is `require()`d from `node_modules` at runtime, add an
explicit `"!node_modules/**/*"`. Always check the real asar contents rather
than trusting the config:

```
npx asar list release/win-unpacked/resources/app.asar | awk -F'\' 'NF==2{print $2}'
```

**Why:** shipped ~360MB of unused Stockfish wasm variants in every v1.0-v1.1.1
release, roughly tripling download size and startup time.

### A `portable` Windows target re-extracts everything on every launch
`win.target: "portable"` unpacks the full payload to `%TEMP%` each time the
app starts, not once. Payload size is startup latency on every run, and
antivirus rescans freshly written binaries each time.

**Rule:** keep the portable payload lean, or use an installer target (`nsis`)
so the cost is paid once. Measure the real cost, don't estimate:

```
Get-ChildItem $env:TEMP -Directory | Where-Object { $_.Name -match '^[0-9A-Za-z]{27}$' }
```

### `requestSingleInstanceLock()` fails silently by design
`if (!gotInstanceLock) app.quit()` produces *exactly* the "splash, then
nothing" symptom when an earlier instance is still starting up, or when a
previous version left a windowless process alive holding the lock. A lock
holder from an old build blocks every new build, so shipping a fix does not
clear it.

**Rule:** never let a startup failure path leave a windowless process alive
(v1.0's unhandled `startServer()` rejection did). When diagnosing "won't
open" on Windows, check Task Manager for existing processes *first*.

## Debugging process

### Reproduce against the real artifact, not a local rebuild
A local `electron-builder` run differed from the CI build by 71MB. Download
the actual release asset and verify it byte-for-byte against the GitHub API
`size` field before concluding anything about it.

### Verify the diagnostic tool before trusting a negative result
A polling loop reported "no process" for 30s and nearly sent the
investigation down a false path. Cause: `Join-String` is PowerShell 7+ and
this machine runs Windows PowerShell 5.1, so the command errored to empty
every iteration.

**Rule:** an empty/negative result from a probe must be confirmed by a probe
known to produce a positive. Assume 5.1 on Windows: no `Join-String`, no
`&&`/`||`, no ternary, no `-AsHashtable`.
