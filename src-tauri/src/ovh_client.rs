use crate::models::{AccessRule, Alias, ApplicationDetail, Config, CredentialDetail, CredentialInfo, CredentialRequest};
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

    pub async fn test_connection(&self) -> Result<CredentialInfo> {
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
        if !status.is_success() {
            return Ok(CredentialInfo {
                connected: false,
                rules: vec![],
                missing_rules: required_rules(),
            });
        }

        let cred: OvhCredential = res.json().await?;
        let rules: Vec<AccessRule> = cred
            .rules
            .into_iter()
            .map(|r| AccessRule {
                method: r.method,
                path: r.path,
            })
            .collect();

        let missing_rules = required_rules()
            .iter()
            .filter(|required| {
                !rules.iter().any(|granted| {
                    rule_matches(granted, required)
                })
            })
            .cloned()
            .collect();

        Ok(CredentialInfo {
            connected: true,
            rules,
            missing_rules,
        })
    }

    pub async fn request_credential(&self) -> Result<CredentialRequest> {
        let url = format!("{}/auth/credential", self.base_url);
        let rules = required_rules();
        let body = serde_json::json!({
            "accessRules": rules.iter().map(|r| {
                serde_json::json!({
                    "method": r.method,
                    "path": r.path
                })
            }).collect::<Vec<_>>(),
            "redirection": format!("{}/auth/callback", self.base_url)
        });
        let body_str = serde_json::to_string(&body)?;
        let timestamp = chrono::Utc::now().timestamp();

        let res = self
            .client
            .post(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("POST", &url, &body_str, timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .header("Content-Type", "application/json")
            .body(body_str)
            .send()
            .await
            .context("Failed to request credential from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error requesting credential (HTTP {}): {}",
                status.as_u16(),
                body
            );
        }

        let result: OvhCredentialRequest = res.json().await?;
        Ok(CredentialRequest {
            consumer_key: result.consumer_key,
            validation_url: result.validation_url,
        })
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

    pub async fn create_redirection(&self, domain: &str, from: &str, to: &str) -> Result<Alias> {
        let url = format!("{}/email/domain/{}/redirection", self.base_url, domain);
        let request_body = serde_json::json!({
            "from": from,
            "to": to,
            "localCopy": false
        });
        let body_str = serde_json::to_string(&request_body)?;
        let timestamp = chrono::Utc::now().timestamp();

        let res = self
            .client
            .post(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("POST", &url, &body_str, timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .header("Content-Type", "application/json")
            .body(body_str)
            .send()
            .await
            .context("Failed to create redirection on OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error creating redirection (HTTP {}): {}",
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

    pub async fn delete_redirection(&self, domain: &str, id: &str) -> Result<()> {
        let url = format!(
            "{}/email/domain/{}/redirection/{}",
            self.base_url, domain, id
        );
        let timestamp = chrono::Utc::now().timestamp();

        let res = self
            .client
            .delete(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("DELETE", &url, "", timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .send()
            .await
            .context("Failed to delete redirection on OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error deleting redirection {} (HTTP {}): {}",
                id,
                status.as_u16(),
                body
            );
        }

        Ok(())
    }

    // --- API Key Management ---

    pub async fn list_credentials(&self) -> Result<Vec<CredentialDetail>> {
        let url = format!("{}/me/api/credential", self.base_url);
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
            .context("Failed to list credentials from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error listing credentials (HTTP {}): {}",
                status.as_u16(),
                body
            );
        }

        let ids: Vec<u64> = res.json().await?;
        let mut details = Vec::new();

        for id in ids {
            match self.get_credential_detail(id).await {
                Ok(detail) => details.push(detail),
                Err(e) => eprintln!("Failed to fetch credential {}: {}", id, e),
            }
        }

        Ok(details)
    }

    async fn get_credential_detail(&self, credential_id: u64) -> Result<CredentialDetail> {
        let url = format!(
            "{}/me/api/credential/{}",
            self.base_url, credential_id
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
            .await
            .context(format!("Failed to fetch credential {}", credential_id))?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error fetching credential {} (HTTP {}): {}",
                credential_id,
                status.as_u16(),
                body
            );
        }

        let cred: OvhCredentialDetailResponse = res.json().await?;

        // Fetch associated application name if available
        let application_name = if let Some(_app_id) = cred.application_id {
            self.get_credential_app_name(credential_id).await.ok()
        } else {
            None
        };

        Ok(CredentialDetail {
            credential_id: cred.credential_id,
            consumer_key: None,
            creation: cred.creation,
            expiration: cred.expiration,
            last_use: cred.last_use,
            ovh_support: cred.ovh_support,
            status: cred.status,
            rules: cred
                .rules
                .into_iter()
                .map(|r| AccessRule {
                    method: r.method,
                    path: r.path,
                })
                .collect(),
            application_id: cred.application_id,
            application_name,
        })
    }

    async fn get_credential_app_name(&self, credential_id: u64) -> Result<String> {
        let url = format!(
            "{}/me/api/credential/{}/application",
            self.base_url, credential_id
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
            .await
            .context(format!(
                "Failed to fetch application for credential {}",
                credential_id
            ))?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error fetching credential app (HTTP {}): {}",
                status.as_u16(),
                body
            );
        }

        let app: OvhCredentialAppResponse = res.json().await?;
        Ok(app.name)
    }

    pub async fn get_current_credential_id(&self) -> Result<u64> {
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
            .await
            .context("Failed to get current credential from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error getting current credential (HTTP {}): {}",
                status.as_u16(),
                body
            );
        }

        let cred: OvhCurrentCredentialResponse = res.json().await?;
        Ok(cred.credential_id)
    }

    pub async fn delete_credential(&self, credential_id: u64) -> Result<()> {
        let url = format!(
            "{}/me/api/credential/{}",
            self.base_url, credential_id
        );
        let timestamp = chrono::Utc::now().timestamp();

        let res = self
            .client
            .delete(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("DELETE", &url, "", timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .send()
            .await
            .context("Failed to delete credential from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error deleting credential {} (HTTP {}): {}",
                credential_id,
                status.as_u16(),
                body
            );
        }

        Ok(())
    }

    pub async fn list_applications(&self) -> Result<Vec<ApplicationDetail>> {
        let url = format!("{}/me/api/application", self.base_url);
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
            .context("Failed to list applications from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error listing applications (HTTP {}): {}",
                status.as_u16(),
                body
            );
        }

        let ids: Vec<u64> = res.json().await?;
        let mut details = Vec::new();

        for id in ids {
            match self.get_application_detail(id).await {
                Ok(detail) => details.push(detail),
                Err(e) => eprintln!("Failed to fetch application {}: {}", id, e),
            }
        }

        Ok(details)
    }

    async fn get_application_detail(&self, application_id: u64) -> Result<ApplicationDetail> {
        let url = format!(
            "{}/me/api/application/{}",
            self.base_url, application_id
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
            .await
            .context(format!("Failed to fetch application {}", application_id))?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error fetching application {} (HTTP {}): {}",
                application_id,
                status.as_u16(),
                body
            );
        }

        let app: OvhApplicationDetailResponse = res.json().await?;

        Ok(ApplicationDetail {
            application_id: app.application_id,
            application_key: app.application_key,
            name: app.name,
            description: app.description,
            status: app.status,
        })
    }

    pub async fn delete_application(&self, application_id: u64) -> Result<()> {
        let url = format!(
            "{}/me/api/application/{}",
            self.base_url, application_id
        );
        let timestamp = chrono::Utc::now().timestamp();

        let res = self
            .client
            .delete(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header("X-Ovh-Consumer", &self.config.consumer_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("DELETE", &url, "", timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .send()
            .await
            .context("Failed to delete application from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error deleting application {} (HTTP {}): {}",
                application_id,
                status.as_u16(),
                body
            );
        }

        Ok(())
    }

    pub async fn request_credential_with_rules(
        &self,
        rules: Vec<AccessRule>,
        redirection: Option<String>,
    ) -> Result<CredentialRequest> {
        let url = format!("{}/auth/credential", self.base_url);
        let rules_json: Vec<serde_json::Value> = rules
            .iter()
            .map(|r| {
                serde_json::json!({
                    "method": r.method,
                    "path": r.path
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "accessRules": rules_json
        });

        if let Some(ref redir) = redirection {
            body["redirection"] = serde_json::Value::String(redir.clone());
        }

        let body_str = serde_json::to_string(&body)?;
        let timestamp = chrono::Utc::now().timestamp();

        let res = self
            .client
            .post(&url)
            .header("X-Ovh-Application", &self.config.app_key)
            .header(
                "X-Ovh-Signature",
                self.sign_request("POST", &url, &body_str, timestamp),
            )
            .header("X-Ovh-Timestamp", timestamp.to_string())
            .header("Content-Type", "application/json")
            .body(body_str)
            .send()
            .await
            .context("Failed to request credential from OVH")?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!(
                "OVH API error requesting credential (HTTP {}): {}",
                status.as_u16(),
                body
            );
        }

        let result: OvhCredentialRequest = res.json().await?;
        Ok(CredentialRequest {
            consumer_key: result.consumer_key,
            validation_url: result.validation_url,
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

#[derive(Debug, Deserialize)]
struct OvhCredential {
    rules: Vec<OvhAccessRule>,
}

#[derive(Debug, Deserialize)]
struct OvhAccessRule {
    method: String,
    path: String,
}

#[derive(Debug, Deserialize)]
struct OvhCredentialRequest {
    consumer_key: String,
    validation_url: String,
}

#[derive(Debug, Deserialize)]
struct OvhCurrentCredentialResponse {
    #[serde(rename = "credentialId")]
    credential_id: u64,
}

#[derive(Debug, Deserialize)]
struct OvhCredentialDetailResponse {
    #[serde(rename = "credentialId")]
    credential_id: u64,
    creation: String,
    expiration: String,
    #[serde(rename = "lastUse", default)]
    last_use: Option<String>,
    #[serde(rename = "ovhSupport", default)]
    ovh_support: bool,
    #[serde(rename = "applicationId", default)]
    application_id: Option<u64>,
    status: String,
    rules: Vec<OvhAccessRule>,
}

#[derive(Debug, Deserialize)]
struct OvhApplicationDetailResponse {
    #[serde(rename = "applicationId")]
    application_id: u64,
    #[serde(rename = "applicationKey")]
    application_key: String,
    name: String,
    #[serde(default)]
    description: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct OvhCredentialAppResponse {
    #[serde(rename = "applicationId")]
    application_id: u64,
    name: String,
    #[serde(default)]
    description: String,
    status: String,
}

fn required_rules() -> Vec<AccessRule> {
    vec![
        AccessRule { method: "GET".to_string(), path: "/email/domain/*/redirection".to_string() },
        AccessRule { method: "GET".to_string(), path: "/email/domain/*/redirection/*".to_string() },
        AccessRule { method: "POST".to_string(), path: "/email/domain/*/redirection".to_string() },
        AccessRule { method: "DELETE".to_string(), path: "/email/domain/*/redirection/*".to_string() },
    ]
}

fn rule_matches(granted: &AccessRule, required: &AccessRule) -> bool {
    if granted.method != required.method {
        return false;
    }
    // A wildcard path like "/*" matches everything
    if granted.path == "/*" {
        return true;
    }
    // Check if the granted path is a prefix/wildcard that covers the required path
    path_matches(&granted.path, &required.path)
}

fn path_matches(pattern: &str, path: &str) -> bool {
    if pattern == path {
        return true;
    }
    // Split both into segments and match with wildcard support
    let pattern_parts: Vec<&str> = pattern.split('/').collect();
    let path_parts: Vec<&str> = path.split('/').collect();

    if pattern_parts.len() != path_parts.len() {
        return false;
    }

    for (p, s) in pattern_parts.iter().zip(path_parts.iter()) {
        if *p == "*" {
            continue; // wildcard matches any segment
        }
        if p != s {
            return false;
        }
    }
    true
}
