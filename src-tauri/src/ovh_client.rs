use crate::models::{Alias, Config};
use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct OvhRedirection {
    id: String,
    #[serde(rename = "from")]
    from_addr: String,
    to: String,
}

pub struct OvhClient {
    client: Client,
    config: Config,
    base_url: String,
}

impl OvhClient {
    pub fn new(config: Config) -> Result<Self> {
        let base_url = match config.endpoint.as_str() {
            "ovh-eu" => "https://api.ovh.com/1.0",
            "ovh-us" => "https://api.us.ovhcloud.com/1.0",
            "ovh-ca" => "https://ca.api.ovh.com/1.0",
            _ => "https://api.ovh.com/1.0",
        };

        Ok(OvhClient {
            client: Client::new(),
            config,
            base_url: base_url.to_string(),
        })
    }

    pub async fn test_connection(&self) -> Result<bool> {
        let url = format!("{}/auth/currentCredential", self.base_url);
        let res = self
            .client
            .get(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("GET", &url, ""),
            )
            .header("X-Ovh-Timestamp", chrono::Utc::now().timestamp().to_string())
            .send()
            .await?;

        Ok(res.status().is_success())
    }

    pub async fn get_redirections(&self, domain: &str) -> Result<Vec<Alias>> {
        let url = format!("{}/email/domain/{}/redirection", self.base_url, domain);
        let res = self
            .client
            .get(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("GET", &url, ""),
            )
            .header("X-Ovh-Timestamp", chrono::Utc::now().timestamp().to_string())
            .send()
            .await
            .context("Failed to fetch redirections from OVH")?;

        let ids: Vec<String> = res.json().await?;
        let mut aliases = Vec::new();

        for id in ids {
            let alias = self.get_redirection(domain, &id).await?;
            aliases.push(alias);
        }

        Ok(aliases)
    }

    async fn get_redirection(&self, domain: &str, id: &str) -> Result<Alias> {
        let url = format!(
            "{}/email/domain/{}/redirection/{}",
            self.base_url, domain, id
        );
        let res = self
            .client
            .get(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("GET", &url, ""),
            )
            .header("X-Ovh-Timestamp", chrono::Utc::now().timestamp().to_string())
            .send()
            .await?;

        let redir: OvhRedirection = res.json().await?;

        Ok(Alias {
            id: redir.id,
            name: String::new(),
            date: chrono::Utc::now().timestamp(),
            alias: redir.from_addr,
            to: redir.to,
        })
    }

    pub async fn create_redirection(&self, alias: &Alias) -> Result<String> {
        let domain = alias
            .alias
            .split('@')
            .nth(1)
            .context("Invalid alias format")?;
        let url = format!("{}/email/domain/{}/redirection", self.base_url, domain);

        let body = serde_json::json!({
            "from": alias.alias,
            "localCopy": false,
            "to": alias.to
        });

        let res = self
            .client
            .post(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("POST", &url, &body.to_string()),
            )
            .header("X-Ovh-Timestamp", chrono::Utc::now().timestamp().to_string())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("Failed to create redirection")?;

        let id: String = res.text().await?;
        Ok(id.trim_matches('"').to_string())
    }

    pub async fn delete_redirection(&self, id: &str, alias: &str) -> Result<()> {
        let domain = alias
            .split('@')
            .nth(1)
            .context("Invalid alias format")?;
        let url = format!(
            "{}/email/domain/{}/redirection/{}",
            self.base_url, domain, id
        );

        let _res = self
            .client
            .delete(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("DELETE", &url, ""),
            )
            .header("X-Ovh-Timestamp", chrono::Utc::now().timestamp().to_string())
            .send()
            .await
            .context("Failed to delete redirection")?;

        Ok(())
    }

    fn sign_request(&self, method: &str, url: &str, body: &str) -> String {
        let timestamp = chrono::Utc::now().timestamp();
        let to_sign = format!(
            "{}+{}+{}+{}+{}{}",
            self.config.app_secret,
            self.config.consumer_key,
            method,
            url,
            body,
            timestamp
        );

        format!("$1${}", sha1_hash(&to_sign))
    }
}

fn sha1_hash(input: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
