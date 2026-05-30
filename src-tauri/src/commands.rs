use crate::models::{Alias, AliasError, Config, CredentialInfo, CredentialRequest, DeleteResult, PushResult, SyncResult};
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

    let domains = config.domains.clone();
    let client = OvhClient::new(config).map_err(|e| e.to_string())?;

    let mut remote_aliases: HashMap<String, Alias> = HashMap::new();

    for domain in &domains {
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

    // Save remote-only aliases to local store
    if !remote_only.is_empty() {
        let mut all_aliases = local_aliases;
        for alias in &remote_only {
            all_aliases.insert(alias.id.clone(), alias.clone());
        }
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.save_aliases(&all_aliases).map_err(|e| e.to_string())?;
    }

    Ok(SyncResult {
        remote_count: remote_aliases.len(),
        local_only,
        remote_only,
    })
}

#[tauri::command]
pub async fn push_to_ovh(state: State<'_, AppState>) -> Result<PushResult, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let local_aliases = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_aliases().map_err(|e| e.to_string())?
    };

    let domains = config.domains.clone();
    let client = OvhClient::new(config).map_err(|e| e.to_string())?;

    // Fetch remote aliases to find which are local-only
    let mut remote_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for domain in &domains {
        match client.get_redirections(domain).await {
            Ok(aliases) => {
                for alias in aliases {
                    remote_ids.insert(alias.id.clone());
                }
            }
            Err(e) => eprintln!("Failed to fetch from {}: {}", domain, e),
        }
    }

    let local_only: Vec<Alias> = local_aliases
        .values()
        .filter(|a| !remote_ids.contains(&a.id))
        .cloned()
        .collect();

    let mut pushed = Vec::new();
    let mut failed = Vec::new();
    let mut updated_aliases = local_aliases.clone();

    for alias in &local_only {
        // Extract domain from alias address (e.g. "work@example.com" → "example.com")
        let domain = alias.alias.rsplit_once('@').map(|(_, d)| d.to_string());
        let domain = match domain {
            Some(d) if domains.contains(&d) => d,
            Some(d) => {
                failed.push(AliasError {
                    alias: alias.alias.clone(),
                    error: format!("Domain '{}' not in configured domains", d),
                });
                continue;
            }
            None => {
                failed.push(AliasError {
                    alias: alias.alias.clone(),
                    error: "Alias address has no @ domain".to_string(),
                });
                continue;
            }
        };

        // Extract local part from alias address
        let local_part = alias.alias.rsplit_once('@').map(|(l, _)| l.to_string()).unwrap_or_default();

        match client.create_redirection(&domain, &local_part, &alias.to).await {
            Ok(new_alias) => {
                // Remove old UUID-keyed entry and insert with OVH ID
                updated_aliases.remove(&alias.id);
                updated_aliases.insert(new_alias.id.clone(), new_alias.clone());
                pushed.push(new_alias);
            }
            Err(e) => {
                failed.push(AliasError {
                    alias: alias.alias.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    // Save updated aliases (with new OVH IDs replacing old UUIDs)
    if !pushed.is_empty() {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.save_aliases(&updated_aliases).map_err(|e| e.to_string())?;
    }

    Ok(PushResult { pushed, failed })
}

#[tauri::command]
pub async fn delete_from_ovh(state: State<'_, AppState>) -> Result<DeleteResult, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let local_aliases = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_aliases().map_err(|e| e.to_string())?
    };

    let domains = config.domains.clone();
    let client = OvhClient::new(config).map_err(|e| e.to_string())?;

    // Fetch remote aliases to find which are remote-only
    let mut remote_aliases: HashMap<String, Alias> = HashMap::new();
    for domain in &domains {
        match client.get_redirections(domain).await {
            Ok(aliases) => {
                for alias in aliases {
                    remote_aliases.insert(alias.id.clone(), alias);
                }
            }
            Err(e) => eprintln!("Failed to fetch from {}: {}", domain, e),
        }
    }

    let remote_only: Vec<Alias> = remote_aliases
        .values()
        .filter(|a| !local_aliases.contains_key(&a.id))
        .cloned()
        .collect();

    let mut deleted = Vec::new();
    let mut failed = Vec::new();

    for alias in &remote_only {
        let domain = alias.alias.rsplit_once('@').map(|(_, d)| d.to_string());
        let domain = match domain {
            Some(d) => d,
            None => {
                failed.push(AliasError {
                    alias: alias.alias.clone(),
                    error: "Alias address has no @ domain".to_string(),
                });
                continue;
            }
        };

        match client.delete_redirection(&domain, &alias.id).await {
            Ok(()) => {
                deleted.push(alias.id.clone());
            }
            Err(e) => {
                failed.push(AliasError {
                    alias: alias.alias.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    Ok(DeleteResult { deleted, failed })
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
pub async fn test_ovh_connection(config: Config) -> Result<CredentialInfo, String> {
    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    client.test_connection().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_ovh_credential(config: Config) -> Result<CredentialRequest, String> {
    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    client.request_credential().await.map_err(|e| e.to_string())
}
