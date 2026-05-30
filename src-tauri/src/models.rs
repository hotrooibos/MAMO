use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alias {
    pub id: String,
    pub name: String,
    pub date: i64,
    pub alias: String,
    pub to: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub endpoint: String,
    pub app_key: String,
    pub app_secret: String,
    pub consumer_key: String,
    pub domains: Vec<String>,
    pub default_dest: String,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            endpoint: "ovh-eu".to_string(),
            app_key: String::new(),
            app_secret: String::new(),
            consumer_key: String::new(),
            domains: vec![],
            default_dest: String::new(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub remote_count: usize,
    pub local_only: Vec<Alias>,
    pub remote_only: Vec<Alias>,
}

#[derive(Debug, Serialize)]
pub struct PushResult {
    pub pushed: Vec<Alias>,
    pub failed: Vec<AliasError>,
}

#[derive(Debug, Serialize)]
pub struct DeleteResult {
    pub deleted: Vec<String>,
    pub failed: Vec<AliasError>,
}

#[derive(Debug, Serialize)]
pub struct AliasError {
    pub alias: String,
    pub error: String,
}

#[derive(Debug, Serialize)]
pub struct CredentialInfo {
    pub connected: bool,
    pub rules: Vec<AccessRule>,
    pub missing_rules: Vec<AccessRule>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessRule {
    pub method: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct CredentialRequest {
    pub consumer_key: String,
    pub validation_url: String,
}
