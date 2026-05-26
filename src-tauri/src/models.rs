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
