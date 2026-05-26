use crate::models::{Alias, Config, SyncResult};
use crate::ovh_client::OvhClient;
use crate::AppState;
use anyhow::Result;
use chrono::Utc;
use rand::seq::SliceRandom;
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_config(state: State<AppState>) -> Result<Config, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.load_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_config(config: Config, state: State<AppState>) -> Result<(), String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_aliases(state: State<AppState>) -> Result<HashMap<String, Alias>, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.load_aliases().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_alias(
    name: String,
    alias_addr: String,
    to: String,
    state: State<AppState>,
) -> Result<Alias, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let alias = Alias {
        id: id.clone(),
        name,
        date: Utc::now().timestamp(),
        alias: alias_addr,
        to,
    };

    aliases.insert(id, alias.clone());
    manager.save_aliases(&aliases).map_err(|e| e.to_string())?;

    Ok(alias)
}

#[tauri::command]
pub fn update_alias(
    id: String,
    name: String,
    alias_addr: String,
    to: String,
    state: State<AppState>,
) -> Result<Alias, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;

    let alias = Alias {
        id: id.clone(),
        name,
        date: Utc::now().timestamp(),
        alias: alias_addr,
        to,
    };

    aliases.insert(id, alias.clone());
    manager.save_aliases(&aliases).map_err(|e| e.to_string())?;

    Ok(alias)
}

#[tauri::command]
pub fn delete_alias(id: String, state: State<AppState>) -> Result<(), String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;

    aliases.remove(&id);
    manager.save_aliases(&aliases).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn sync_with_ovh(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let local_aliases = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_aliases().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;

    let mut remote_aliases: HashMap<String, Alias> = HashMap::new();

    for domain in &["example.com"] {
        match client.get_redirections(domain).await {
            Ok(aliases) => {
                for alias in aliases {
                    remote_aliases.insert(alias.id.clone(), alias);
                }
            }
            Err(e) => eprintln!("Failed to fetch from {}: {}", domain, e),
        }
    }

    let local_only: Vec<Alias> = local_aliases
        .values()
        .filter(|a| !remote_aliases.contains_key(&a.id))
        .cloned()
        .collect();

    let remote_only: Vec<Alias> = remote_aliases
        .values()
        .filter(|a| !local_aliases.contains_key(&a.id))
        .cloned()
        .collect();

    Ok(SyncResult {
        remote_count: remote_aliases.len(),
        local_only,
        remote_only,
    })
}

#[tauri::command]
pub fn generate_random_name() -> String {
    let adjectives = vec![
        "quick", "lazy", "sleepy", "noisy", "hungry", "brave", "calm", "eager",
    ];
    let nouns = vec![
        "fox", "dog", "cat", "mouse", "bear", "wolf", "bird", "fish",
    ];

    let adj = adjectives.choose(&mut rand::thread_rng()).unwrap();
    let noun = nouns.choose(&mut rand::thread_rng()).unwrap();

    format!("{}-{}", adj, noun)
}

#[tauri::command]
pub async fn test_ovh_connection(state: State<'_, AppState>) -> Result<bool, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;

    client.test_connection().await.map_err(|e| e.to_string())
}
