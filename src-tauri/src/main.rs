#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod models;
mod ovh_client;

use commands::*;
use config::ConfigManager;
use std::sync::Mutex;

pub struct AppState {
    pub config_manager: Mutex<ConfigManager>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            config_manager: Mutex::new(ConfigManager::new(
                dirs::config_dir().unwrap().join("mamo"),
            )),
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            get_aliases,
            create_alias,
            update_alias,
            delete_alias,
            sync_with_ovh,
            generate_random_name,
            test_ovh_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
