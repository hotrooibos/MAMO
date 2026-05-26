use crate::models::{Alias, Config};
use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;

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

    pub async fn test_connection(&self) -> Result<String> {
        let url = format!("{}/auth/currentCredential", self.base_url);
        let timestamp = chrono::Utc::now().timestamp();
        let res = self
            .client
            .get(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("GET", &url, "", timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .send()
            .await?;

        let status = res.status();
        let body = res.text().await.unwrap_or_default();

        if status.is_success() {
            Ok("Connected successfully".to_string())
        } else {
            Ok(format!("Connection failed (HTTP {}): {}", status.as_u16(), body))
        }
    }

    pub async fn get_redirections(&self, domain: &str) -> Result<Vec<Alias>> {
        let url = format!("{}/email/domain/{}/redirection", self.base_url, domain);
        let timestamp = chrono::Utc::now().timestamp();
        let res = self
            .client
            .get(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("GET", &url, "", timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .send()
            .await
            .context("Failed to fetch redirections from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error for domain {} (HTTP {}): {}",
                domain,
                status.as_u16(),
                body
            );
        }

        let ids: Vec<i64> = res.json().await?;
        let mut aliases = Vec::new();

        for id in ids {
            let id_str = id.to_string();
            let alias = self.get_redirection(domain, &id_str).await?;
            aliases.push(alias);
        }

        Ok(aliases)
    }

    async fn get_redirection(&self, domain: &str, id: &str) -> Result<Alias> {
        let url = format!(
            "{}/email/domain/{}/redirection/{}",
            self.base_url, domain, id
        );
        let timestamp = chrono::Utc::now().timestamp();
        let res = self
            .client
            .get(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("GET", &url, "", timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .send()
            .await?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error fetching redirection {} (HTTP {}): {}",
                id,
                status.as_u16(),
                body
            );
        }

        let redir: OvhRedirection = res.json().await?;

        Ok(Alias {
            id: redir.id,
            name: String::new(),
            date: chrono::Utc::now().timestamp(),
            alias: redir.from_addr,
            to: redir.to,
        })
    }

    fn sign_request(&self, method: &str, url: &str, body: &str, timestamp: i64) -> String {
        let to_sign = format!(
            "{}+{}+{}+{}+{}+{}",
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
    use sha1::{Digest, Sha1};

    let mut hasher = Sha1::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}
