use crate::models::{Alias, Config};
use anyhow::Result;
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

pub struct ConfigManager {
    config_dir: PathBuf,
}

impl ConfigManager {
    pub fn new(config_dir: PathBuf) -> Self {
        ConfigManager { config_dir }
    }

    pub fn load_config(&self) -> Result<Config> {
        let path = self.config_dir.join("config.json");
        if path.exists() {
            let contents = fs::read_to_string(path)?;
            let config: Config = serde_json::from_str(&contents)?;
            Ok(config)
        } else {
            Ok(Config::default())
        }
    }

    pub fn save_config(&self, config: &Config) -> Result<()> {
        fs::create_dir_all(&self.config_dir)?;
        let path = self.config_dir.join("config.json");
        let contents = serde_json::to_string_pretty(config)?;
        fs::write(path, contents)?;
        Ok(())
    }

    pub fn load_aliases(&self) -> Result<HashMap<String, Alias>> {
        let path = self.config_dir.join("aliases.json");
        if path.exists() {
            let contents = fs::read_to_string(path)?;
            let aliases: HashMap<String, Alias> = serde_json::from_str(&contents)?;
            Ok(aliases)
        } else {
            Ok(HashMap::new())
        }
    }

    pub fn save_aliases(&self, aliases: &HashMap<String, Alias>) -> Result<()> {
        fs::create_dir_all(&self.config_dir)?;
        let path = self.config_dir.join("aliases.json");
        let contents = serde_json::to_string_pretty(aliases)?;
        fs::write(path, contents)?;
        Ok(())
    }

    pub fn load_known_consumer_keys(&self) -> Result<Vec<String>> {
        let path = self.config_dir.join("known_consumer_keys.json");
        if path.exists() {
            let contents = fs::read_to_string(path)?;
            let keys: Vec<String> = serde_json::from_str(&contents)?;
            Ok(keys)
        } else {
            Ok(Vec::new())
        }
    }

    pub fn save_known_consumer_keys(&self, keys: &[String]) -> Result<()> {
        fs::create_dir_all(&self.config_dir)?;
        let path = self.config_dir.join("known_consumer_keys.json");
        let contents = serde_json::to_string_pretty(keys)?;
        fs::write(path, contents)?;
        Ok(())
    }
}
