# MAMO Desktop - Mail Aliases Manager

Tauri v2 desktop application for managing OVH mail aliases. Create, edit, delete, and sync mail redirections across your OVH domains.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) (system libs, webkit2gtk on Linux, etc.)

No Node.js or npm required — the frontend is plain HTML/JS/CSS served directly by Tauri.

## Development

```bash
# Start dev server (frontend on localhost:1420, hot reload)
cargo tauri dev

# Production build
cargo tauri build

# Build Rust backend only (skip Tauri bundling)
cargo build --manifest-path src-tauri/Cargo.toml
```

## Project Structure

```
src/                  # Frontend (static HTML/JS/CSS)
  index.html            Single-page app shell
  app.js                All frontend logic, IPC calls to Rust backend
  style.css             Dark theme styles

src-tauri/            # Rust backend (Tauri v2)
  src/
    main.rs             App init, AppState (Mutex<ConfigManager>)
    commands.rs         #[tauri::command] handlers (get_config, save_config,
                         get_aliases, create_alias, update_alias, delete_alias,
                         sync_with_ovh, generate_random_name, test_ovh_connection)
    config.rs           ConfigManager — reads/writes JSON at config dir
    models.rs           Alias, Config, SyncResult structs
    ovh_client.rs       OVH API client with request signing
  tauri.conf.json       Tauri config (window size, CSP, frontendDist)
  Cargo.toml            Rust dependencies
```

## Configuration

App data is stored at `dirs::config_dir()/mamo-tauri/` (typically `~/.config/mamo-tauri/` on Linux):

- **`config.json`** — OVH API credentials and domain list (`endpoint`, `app_key`, `app_secret`, `consumer_key`, `domains`, `default_dest`)
- **`aliases.json`** — Local alias cache (`HashMap<String, Alias>`)

OVH API credentials can be obtained from [OVH API console](https://api.ovh.com/console/).

## Known Issues

- **Broken request signing** — `ovh_client.rs` uses `std::hash::DefaultHasher` instead of SHA-1. The OVH API requires SHA-1 signatures, so all authenticated requests will fail against real endpoints.
- **Hardcoded domain** — `sync_with_ovh` iterates over `["example.com"]` instead of `config.domains`.
- **CSP disabled** — `tauri.conf.json` sets `"csp": null`. Acceptable for development but must be tightened before production.


