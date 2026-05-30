# MAMO

Tauri v2 desktop app for managing OVH mail aliases. Rust backend, plain HTML/JS/CSS frontend (no bundler, no Node.js).

## Commands

```bash
# Dev (starts Tauri dev server, frontend served from src/ on localhost:1420)
cargo tauri dev

# Production build
cargo tauri build

# Build Rust backend only (no Tauri bundling)
cargo build --manifest-path src-tauri/Cargo.toml
```

No tests, linter, or formatter are configured.

## Architecture

- **`src/`** — Static frontend (HTML/JS/CSS). No bundler; Tauri serves these files directly via `frontendDist`.
- **`src-tauri/`** — Rust backend (Tauri v2 app).
  - `main.rs` — App setup, `AppState` holds `Mutex<ConfigManager>`.
  - `commands.rs` — All `#[tauri::command]` handlers invoked from JS via `window.__TAURI__.invoke()`.
  - `config.rs` — `ConfigManager` reads/writes JSON files at `$XDG_CONFIG_HOME/mamo/`.
  - `models.rs` — `Alias`, `Config`, `SyncResult` structs.
  - `ovh_client.rs` — OVH API client with request signing.

Frontend-to-backend IPC uses `window.__TAURI__.invoke('command_name', {args})` (not `@tauri-apps/api` npm package — there is no npm).

## Data Storage

App data lives at `dirs::config_dir()/mamo/`:
- `config.json` — OVH credentials and domain list
- `aliases.json` — Local alias store (`HashMap<String, Alias>`)

## Known Issues

- **`tauri.conf.json`**: CSP is disabled (`"csp": null`). Fine for dev, should be tightened for production.

## Tauri v2 Notes

This is Tauri **v2**, not v1. Key differences: plugin registration uses `.plugin()`, state management uses `.manage()`, and the JS API is accessed via `window.__TAURI__` global (not the v1 `@tauri-apps/api` package).
