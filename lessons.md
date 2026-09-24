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

### Kill every running instance before timing a cold start
A startup measurement read "window up in 1s" that was actually detecting a
*different*, already-running instance; the process just launched had hit the
single-instance lock and quit. The giveaway was an empty log plus exit code 0.
Related tell: `rm` reporting "Device or resource busy" on the old binary meant
it was still running.

**Rule:** before timing or verifying a launch, kill all instances and confirm
the process list is empty. Verify a *positive* signal from the process you
started (its own log line), never just "a window exists".

## Electron windows

### A "silent no-op" launch is almost always the single-instance lock
`requestSingleInstanceLock()` returning false followed by a bare `app.quit()`
gives the user nothing to look at. It is indistinguishable from the app being
broken, and it persists until the lock holder dies.

**Rule:** never quit silently on a lost lock. Verify the holder is actually
serving (a liveness probe against a port the primary records in `userData`),
and if it is not, say so and name the recovery command. Equally: no startup
path may leave a process alive without a window - bound it with a timeout.

### `show: false` is a no-window bug waiting to happen
Hiding a window until it has been measured is the right way to avoid a resize
flash, but if the measuring step throws or never resolves, the window is never
shown and the app looks dead.

**Rule:** pair every `show: false` with a timer that reveals the window
regardless, and make the reveal idempotent.

### Size a window by measuring the page, not by guessing
A hardcoded `height` in `BrowserWindow` is *outer* size; the client area is
smaller by the frame. `1100x750` gave ~1084x711 of usable space against a
layout needing 1100x850, so the app shipped with a permanent scrollbar.

**Rule:** measure the real content (`element.getBoundingClientRect().bottom`)
and apply it with `setContentSize()`, which takes inner dimensions. Clamp to
`screen.getDisplayNearestPoint(...).workAreaSize` so it still fits small
displays.

### Git Bash mangles `/X` style flags into Windows paths
`./Setup.exe /S` from Git Bash does not reach the program as `/S` - MSYS path
conversion rewrites it. The NSIS installer therefore ignored the silent flag
and sat waiting on its GUI, looking like a hang (the tell: 0.5s of CPU over
49s of elapsed time).

**Rule:** pass `/`-prefixed flags to native Windows executables through
PowerShell (`Start-Process -ArgumentList '/S' -Wait`) or set
`MSYS2_ARG_CONV_EXCL='*'`. When a Windows process seems hung, compare its CPU
time against elapsed time before assuming it is working.
