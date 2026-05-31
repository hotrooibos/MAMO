use crate::models::{AccessRule, Alias, AliasError, ApplicationDetail, Config, CredentialDetail, CredentialInfo, CredentialRequest, DeleteResult, PushResult, SyncResult};
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
        alias: alias_addr.to_lowercase(),
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
        alias: alias_addr.to_lowercase(),
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

    let remote_addresses: std::collections::HashSet<&str> =
        remote_aliases.values().map(|a| a.alias.as_str()).collect();
    let local_addresses: std::collections::HashSet<&str> =
        local_aliases.values().map(|a| a.alias.as_str()).collect();

    let local_only: Vec<Alias> = local_aliases
        .values()
        .filter(|a| !remote_aliases.contains_key(&a.id) && !remote_addresses.contains(a.alias.as_str()))
        .cloned()
        .collect();

    let remote_only: Vec<Alias> = remote_aliases
        .values()
        .filter(|a| !local_aliases.contains_key(&a.id) && !local_addresses.contains(a.alias.as_str()))
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
    let mut remote_addresses: std::collections::HashSet<String> = std::collections::HashSet::new();
    for domain in &domains {
        match client.get_redirections(domain).await {
            Ok(aliases) => {
                for alias in aliases {
                    remote_ids.insert(alias.id.clone());
                    remote_addresses.insert(alias.alias.to_lowercase());
                }
            }
            Err(e) => eprintln!("Failed to fetch from {}: {}", domain, e),
        }
    }

    let local_only: Vec<Alias> = local_aliases
        .values()
        .filter(|a| !remote_ids.contains(&a.id) && !remote_addresses.contains(&a.alias.to_lowercase()))
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

        match client.create_redirection(&domain, &alias.alias.to_lowercase(), &alias.to).await {
            Ok(mut new_alias) => {
                new_alias.name = alias.name.clone();
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

    let local_addresses: std::collections::HashSet<&str> =
        local_aliases.values().map(|a| a.alias.as_str()).collect();

    let remote_only: Vec<Alias> = remote_aliases
        .values()
        .filter(|a| !local_aliases.contains_key(&a.id) && !local_addresses.contains(a.alias.as_str()))
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
pub async fn request_ovh_credential(config: Config, state: State<'_, AppState>) -> Result<CredentialRequest, String> {
    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    let result = client.request_credential().await.map_err(|e| e.to_string())?;

    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let mut keys = manager.load_known_consumer_keys().map_err(|e| e.to_string())?;
    if !keys.contains(&result.consumer_key) {
        keys.push(result.consumer_key.clone());
        manager.save_known_consumer_keys(&keys).map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[tauri::command]
pub async fn list_ovh_credentials(state: State<'_, AppState>) -> Result<Vec<CredentialDetail>, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let known_keys = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_known_consumer_keys().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config.clone()).map_err(|e| e.to_string())?;
    let mut credentials = client.list_credentials().await.map_err(|e| e.to_string())?;

    // Build mapping of credential_id -> consumer_key by trying each known key
    let mut credential_map: std::collections::HashMap<u64, String> = std::collections::HashMap::new();
    for key in &known_keys {
        if key == &config.consumer_key {
            // Current config key — use existing client
            match client.get_current_credential_id().await {
                Ok(id) => { credential_map.insert(id, key.clone()); }
                Err(e) => eprintln!("Failed to resolve current credential: {}", e),
            }
        } else {
            // Try with a temporary client using this key
            let mut test_config = config.clone();
            test_config.consumer_key = key.clone();
            match OvhClient::new(test_config) {
                Ok(test_client) => {
                    match test_client.get_current_credential_id().await {
                        Ok(id) => { credential_map.insert(id, key.clone()); }
                        Err(e) => eprintln!("Failed to resolve credential for key {}: {}", key, e),
                    }
                }
                Err(e) => eprintln!("Failed to create client for key {}: {}", key, e),
            }
        }
    }

    for cred in &mut credentials {
        if let Some(key) = credential_map.get(&cred.credential_id) {
            cred.consumer_key = Some(key.clone());
        }
    }

    Ok(credentials)
}

#[tauri::command]
pub async fn delete_ovh_credential(credential_id: u64, state: State<'_, AppState>) -> Result<(), String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    client.delete_credential(credential_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_ovh_applications(state: State<'_, AppState>) -> Result<Vec<ApplicationDetail>, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    client.list_applications().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_ovh_application(application_id: u64, state: State<'_, AppState>) -> Result<(), String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    client.delete_application(application_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_ovh_credential_with_rules(
    rules: Vec<AccessRule>,
    redirection: Option<String>,
    state: State<'_, AppState>,
) -> Result<CredentialRequest, String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    let result = client.request_credential_with_rules(rules, redirection).await.map_err(|e| e.to_string())?;

    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let mut keys = manager.load_known_consumer_keys().map_err(|e| e.to_string())?;
    if !keys.contains(&result.consumer_key) {
        keys.push(result.consumer_key.clone());
        manager.save_known_consumer_keys(&keys).map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[tauri::command]
pub async fn update_alias_remote(
    id: String,
    name: String,
    alias_addr: String,
    to: String,
    state: State<'_, AppState>,
) -> Result<Alias, String> {
    let alias_addr = alias_addr.to_lowercase();

    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let (old_alias, is_uuid) = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        let aliases = manager.load_aliases().map_err(|e| e.to_string())?;
        let old = aliases.get(&id).cloned().ok_or_else(|| "Alias not found".to_string())?;
        (old, Uuid::parse_str(&id).is_ok())
    };

    if is_uuid {
        let alias = Alias {
            id: id.clone(),
            name,
            date: old_alias.date,
            alias: alias_addr,
            to,
        };
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;
        aliases.insert(id, alias.clone());
        manager.save_aliases(&aliases).map_err(|e| e.to_string())?;
        Ok(alias)
    } else {
        let domain = old_alias.alias.rsplit_once('@').map(|(_, d)| d.to_string());
        let domain = match domain {
            Some(ref d) if config.domains.contains(d) => d.clone(),
            _ => return Err("Domain not in configured domains".to_string()),
        };

        let client = OvhClient::new(config).map_err(|e| e.to_string())?;

        match client.delete_redirection(&domain, &id).await {
            Ok(()) => {},
            Err(e) => {
                if !e.to_string().contains("HTTP 404") {
                    return Err(format!("Failed to update alias: {}", e));
                }
            }
        }

        let mut new_alias = client.create_redirection(&domain, &alias_addr, &to)
            .await
            .map_err(|e| format!("Failed to update alias: {}", e))?;

        new_alias.name = name;
        new_alias.date = old_alias.date;

        {
            let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
            let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;
            aliases.remove(&id);
            aliases.insert(new_alias.id.clone(), new_alias.clone());
            manager.save_aliases(&aliases).map_err(|e| e.to_string())?;
        }

        Ok(new_alias)
    }
}

#[tauri::command]
pub async fn delete_alias_remote(
    alias_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let alias = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        let aliases = manager.load_aliases().map_err(|e| e.to_string())?;
        aliases.get(&alias_id).cloned().ok_or_else(|| "Alias not found".to_string())?
    };

    let domain = alias.alias.rsplit_once('@').map(|(_, d)| d.to_string());
    if let Some(ref domain) = domain {
        if config.domains.contains(domain) {
            let client = OvhClient::new(config).map_err(|e| e.to_string())?;
            match client.delete_redirection(domain, &alias_id).await {
                Ok(()) => {},
                Err(e) => {
                    if !e.to_string().contains("HTTP 404") {
                        return Err(format!("Failed to delete from OVH: {}", e));
                    }
                }
            }
        }
    }

    {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;
        aliases.remove(&alias_id);
        manager.save_aliases(&aliases).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn push_single_alias(
    name: String,
    alias_addr: String,
    to: String,
    state: State<'_, AppState>,
) -> Result<Alias, String> {
    let alias_addr = alias_addr.to_lowercase();
    let config = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        manager.load_config().map_err(|e| e.to_string())?
    };

    let domain = alias_addr.rsplit_once('@').map(|(_, d)| d.to_string());
    let domain = match domain {
        Some(d) if config.domains.contains(&d) => d,
        _ => return Err("Domain not in configured domains".to_string()),
    };

    let client = OvhClient::new(config).map_err(|e| e.to_string())?;
    let mut new_alias = client.create_redirection(&domain, &alias_addr, &to)
        .await
        .map_err(|e| e.to_string())?;

    new_alias.name = name;

    {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        let mut aliases = manager.load_aliases().map_err(|e| e.to_string())?;
        aliases.insert(new_alias.id.clone(), new_alias.clone());
        manager.save_aliases(&aliases).map_err(|e| e.to_string())?;
    }

    Ok(new_alias)
}

#[tauri::command]
pub fn switch_ovh_credential(consumer_key: String, state: State<AppState>) -> Result<Config, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let mut config = manager.load_config().map_err(|e| e.to_string())?;
    config.consumer_key = consumer_key.clone();
    manager.save_config(&config).map_err(|e| e.to_string())?;

    let mut keys = manager.load_known_consumer_keys().map_err(|e| e.to_string())?;
    if !keys.contains(&consumer_key) {
        keys.push(consumer_key);
        manager.save_known_consumer_keys(&keys).map_err(|e| e.to_string())?;
    }

    Ok(config)
}
