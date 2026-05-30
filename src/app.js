let aliases = {};
let config = {};
let invoke;
let selectedDomain = '';
let apiKeysVisible = false;
let currentTab = 'credentials';

async function loadAliases() {
    try {
        aliases = await invoke('get_aliases');
        renderAliases();
    } catch (e) {
        console.error('Failed to load aliases:', e);
        showError('Failed to load aliases');
    }
}

async function loadConfig() {
    try {
        config = await invoke('get_config');
        populateSettingsForm();
    } catch (e) {
        console.error('Failed to load config:', e);
    }
}

function renderAliases() {
    const tbody = document.getElementById('aliases-body');
    const searchInput = document.getElementById('search');
    const searchTerm = searchInput.value.toLowerCase();
    
    tbody.innerHTML = '';
    let count = 0;
    
    Object.values(aliases).forEach(alias => {
        if (selectedDomain) {
            const domain = alias.alias.split('@').pop();
            if (domain !== selectedDomain && !domain.endsWith('.' + selectedDomain)) {
                return;
            }
        }
        
        if (searchTerm && !matchesSearch(alias, searchTerm)) {
            return;
        }
        
        count++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(alias.name)}</td>
            <td>${formatDate(alias.date)}</td>
            <td>${escapeHtml(alias.alias)}</td>
            <td>${escapeHtml(alias.to)}</td>
            <td class="actions">
                <button data-action="edit" data-id="${escapeHtml(alias.id)}">Edit</button>
                <button data-action="delete" data-id="${escapeHtml(alias.id)}" class="btn-delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    searchInput.placeholder = 'Search ' + count + ' alias' + (count !== 1 ? 'es' : '');
}

function matchesSearch(alias, term) {
    return alias.name.toLowerCase().includes(term) ||
           alias.alias.toLowerCase().includes(term) ||
           alias.to.toLowerCase().includes(term);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
}

function formatIsoDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

async function loadCredentials() {
    try {
        const credentials = await invoke('list_ovh_credentials');
        renderCredentials(credentials);
    } catch (e) {
        console.error('Failed to load credentials:', e);
        showError('Failed to load credentials: ' + e);
    }
}

async function loadApplications() {
    try {
        const applications = await invoke('list_ovh_applications');
        renderApplications(applications);
    } catch (e) {
        console.error('Failed to load applications:', e);
        showError('Failed to load applications: ' + e);
    }
}

function renderCredentials(credentials) {
    const container = document.getElementById('credentials-list');
    if (!credentials || credentials.length === 0) {
        container.innerHTML = '<p class="key-item">No consumer keys found.</p>';
        return;
    }

    container.innerHTML = '';
    credentials.forEach(cred => {
        const isActive = config.consumer_key && cred.consumer_key === config.consumer_key;
        const statusClass = cred.status === 'validated' ? 'validated' :
                           cred.status === 'expired' ? 'expired' : 'pending';
        const item = document.createElement('div');
        item.className = 'key-item' + (isActive ? ' active' : '');

        let rulesHtml = '';
        if (cred.rules && cred.rules.length > 0) {
            rulesHtml = '<div class="access-rules">';
            cred.rules.forEach(rule => {
                rulesHtml += `<div class="rule-item"><span class="rule-badge">${escapeHtml(rule.method)}</span><span>${escapeHtml(rule.path)}</span></div>`;
            });
            rulesHtml += '</div>';
        }

        const switchBtn = cred.consumer_key
            ? `<button class="btn-switch" data-action="switch" data-key="${escapeHtml(cred.consumer_key)}">Switch</button>`
            : '';

        item.innerHTML = `
            <div class="key-header">
                <div class="key-id">${escapeHtml(cred.credential_id)}</div>
                <div class="key-status">
                    <span class="status-badge ${statusClass}">${escapeHtml(cred.status)}</span>
                    ${isActive ? '<span class="status-badge validated">Active</span>' : ''}
                </div>
                <div class="key-actions">
                    ${switchBtn}
                    <button class="btn-delete" data-action="delete" data-id="${escapeHtml(cred.credential_id)}">Delete</button>
                </div>
            </div>
            <div class="key-details">
                <div><span class="detail-label">Created</span><span class="detail-value">${formatIsoDate(cred.creation)}</span></div>
                <div><span class="detail-label">Expiration</span><span class="detail-value">${formatIsoDate(cred.expiration)}</span></div>
                <div><span class="detail-label">Last Use</span><span class="detail-value">${formatIsoDate(cred.last_use)}</span></div>
                <div><span class="detail-label">Application</span><span class="detail-value">${escapeHtml(cred.application_name || '—')}</span></div>
            </div>
            ${rulesHtml}
        `;
        container.appendChild(item);
    });
}

function renderApplications(applications) {
    const container = document.getElementById('applications-list');
    if (!applications || applications.length === 0) {
        container.innerHTML = '<p class="key-item">No applications found.</p>';
        return;
    }

    container.innerHTML = '';
    applications.forEach(app => {
        const item = document.createElement('div');
        item.className = 'key-item';
        item.innerHTML = `
            <div class="key-header">
                <div class="key-id">${escapeHtml(app.application_id)}</div>
                <div class="key-actions">
                    <button class="btn-delete" data-action="delete-app" data-id="${escapeHtml(app.application_id)}">Delete</button>
                </div>
            </div>
            <div class="key-details">
                <div><span class="detail-label">Name</span><span class="detail-value">${escapeHtml(app.name || '—')}</span></div>
                <div><span class="detail-label">Description</span><span class="detail-value">${escapeHtml(app.description || '—')}</span></div>
                <div><span class="detail-label">Application Key</span><span class="detail-value">${escapeHtml(app.application_key || '—')}</span></div>
                <div><span class="detail-label">Status</span><span class="detail-value">${escapeHtml(app.status || '—')}</span></div>
            </div>
        `;
        container.appendChild(item);
    });
}

async function deleteCredential(credentialId) {
    if (!confirm('Are you sure you want to delete this consumer key?')) return;
    try {
        await invoke('delete_ovh_credential', { credentialId });
        await loadCredentials();
    } catch (e) {
        console.error('Failed to delete credential:', e);
        showError('Failed to delete credential: ' + e);
    }
}

async function deleteApplication(applicationId) {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
        await invoke('delete_ovh_application', { applicationId });
        await loadApplications();
    } catch (e) {
        console.error('Failed to delete application:', e);
        showError('Failed to delete application: ' + e);
    }
}

async function switchCredential(consumerKey) {
    if (!confirm('Switch to this consumer key?')) return;
    try {
        await invoke('switch_ovh_credential', { consumerKey });
        config.consumer_key = consumerKey;
        populateSettingsForm();
        await loadCredentials();
    } catch (e) {
        console.error('Failed to switch credential:', e);
        showError('Failed to switch credential: ' + e);
    }
}

function addRuleRow(method = 'GET', path = '') {
    const container = document.getElementById('rules-container');
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.innerHTML = `
        <select>
            <option value="GET" ${method === 'GET' ? 'selected' : ''}>GET</option>
            <option value="POST" ${method === 'POST' ? 'selected' : ''}>POST</option>
            <option value="PUT" ${method === 'PUT' ? 'selected' : ''}>PUT</option>
            <option value="DELETE" ${method === 'DELETE' ? 'selected' : ''}>DELETE</option>
        </select>
        <input type="text" placeholder="/domain/zone/*/redirection" value="${escapeHtml(path)}">
        <button type="button" onclick="removeRuleRow(this)">Remove</button>
    `;
    container.appendChild(row);
}

function removeRuleRow(btn) {
    const row = btn.closest('.rule-row');
    if (row) row.remove();
}

function showCreateCredentialPanel() {
    document.getElementById('create-credential-panel').classList.remove('hidden');
    document.getElementById('credential-result').classList.add('hidden');
    document.getElementById('rules-container').innerHTML = '';
    // Add default rules
    addRuleRow('GET', '/domain/zone/*/redirection');
    addRuleRow('POST', '/domain/zone/*/redirection');
    addRuleRow('PUT', '/domain/zone/*/redirection/*');
    addRuleRow('DELETE', '/domain/zone/*/redirection/*');
}

function hideCreateCredentialPanel() {
    document.getElementById('create-credential-panel').classList.add('hidden');
    document.getElementById('credential-result').classList.add('hidden');
}

async function createCredentialWithRules() {
    const rows = document.querySelectorAll('#rules-container .rule-row');
    const rules = [];
    rows.forEach(row => {
        const method = row.querySelector('select').value;
        const path = row.querySelector('input').value.trim();
        if (path) {
            rules.push({ method, path });
        }
    });

    if (rules.length === 0) {
        showError('Please add at least one access rule.');
        return;
    }

    const redirection = document.getElementById('credential-redirection').value.trim() || null;
    const resultEl = document.getElementById('credential-result');

    try {
        const result = await invoke('request_ovh_credential_with_rules', { rules, redirection });
        let html = '<h4>New Consumer Key</h4>';
        html += `<p><strong>Consumer Key:</strong> <code>${escapeHtml(result.consumer_key)}</code></p>`;
        if (result.validation_url) {
            html += `<p><a href="${escapeHtml(result.validation_url)}" target="_blank" rel="noopener">Click here to approve the key</a></p>`;
        }
        html += '<p class="text-warning">After approving, you can switch to this key from the list above.</p>';
        resultEl.innerHTML = html;
        resultEl.classList.remove('hidden');
        await loadCredentials();
    } catch (e) {
        console.error('Failed to create credential:', e);
        showError('Failed to create credential: ' + e);
    }
}

async function editAlias(id) {
    const alias = aliases[id];
    if (!alias) return;
    
    document.getElementById('alias-modal-title').textContent = 'Edit Alias';
    document.getElementById('alias-id').value = alias.id;
    document.getElementById('alias-name').value = alias.name;
    
    const [local, domain] = alias.alias.split('@');
    document.getElementById('alias-address').value = local;
    document.getElementById('alias-domain').textContent = '@' + domain;
    document.getElementById('alias-to').value = alias.to;
    
    showModal('modal-alias');
}

async function deleteAlias(id) {
    if (!confirm('Are you sure you want to delete this alias?')) {
        return;
    }
    
    try {
        await invoke('delete_alias', { id });
        await loadAliases();
    } catch (e) {
        console.error('Failed to delete alias:', e);
        showError('Failed to delete alias');
    }
}

function populateSettingsForm() {
    document.getElementById('endpoint').value = config.endpoint || 'ovh-eu';
    document.getElementById('app-key').value = config.app_key || '';
    document.getElementById('app-secret').value = config.app_secret || '';
    document.getElementById('consumer-key').value = config.consumer_key || '';
    document.getElementById('domains').value = (config.domains || []).join(',');
    document.getElementById('default-dest').value = config.default_dest || '';
}

function populateDomainFilter() {
    const select = document.getElementById('domain-filter');
    const domains = config.domains || [];
    const previousValue = selectedDomain;

    select.innerHTML = '';

    if (domains.length >= 2) {
        const allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'All domains';
        select.appendChild(allOpt);
    }

    domains.forEach(domain => {
        const opt = document.createElement('option');
        opt.value = domain;
        opt.textContent = domain;
        select.appendChild(opt);
    });

    // Preserve previous selection if still valid, otherwise default to first
    if (domains.includes(previousValue)) {
        selectedDomain = previousValue;
    } else if (domains.length === 1) {
        selectedDomain = domains[0];
    } else {
        selectedDomain = '';
    }

    select.value = selectedDomain;
}

function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showError(message) {
    alert(message);
}

function renderSyncResults(result) {
    const container = document.getElementById('sync-results');
    let html = `<p>Remote aliases: ${result.remote_count}</p>`;
    
    if (result.local_only.length > 0) {
        html += `<h3>Local only (${result.local_only.length})</h3><ul>`;
        result.local_only.forEach(alias => {
            html += `<li>${escapeHtml(alias.alias)} → ${escapeHtml(alias.to)}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.remote_only.length > 0) {
        html += `<h3>Remote only (${result.remote_only.length})</h3><ul>`;
        result.remote_only.forEach(alias => {
            html += `<li>${escapeHtml(alias.alias)} → ${escapeHtml(alias.to)}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.local_only.length === 0 && result.remote_only.length === 0) {
        html += '<p>In sync!</p>';
    }
    
    container.innerHTML = html;
}

function renderPushResults(result) {
    const container = document.getElementById('sync-results');
    let html = '';
    
    if (result.pushed.length > 0) {
        html += `<h3>Pushed to OVH (${result.pushed.length})</h3><ul>`;
        result.pushed.forEach(alias => {
            html += `<li>${escapeHtml(alias.alias)} → ${escapeHtml(alias.to)}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.failed.length > 0) {
        html += `<h3>Failed (${result.failed.length})</h3><ul>`;
        result.failed.forEach(err => {
            html += `<li>${escapeHtml(err.alias)}: ${escapeHtml(err.error)}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.pushed.length === 0 && result.failed.length === 0) {
        html += '<p>Nothing to push.</p>';
    }
    
    container.innerHTML = html;
}

function renderDeleteResults(result) {
    const container = document.getElementById('sync-results');
    let html = '';
    
    if (result.deleted.length > 0) {
        html += `<h3>Deleted from OVH (${result.deleted.length})</h3><ul>`;
        result.deleted.forEach(id => {
            html += `<li>${escapeHtml(id)}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.failed.length > 0) {
        html += `<h3>Failed (${result.failed.length})</h3><ul>`;
        result.failed.forEach(err => {
            html += `<li>${escapeHtml(err.alias)}: ${escapeHtml(err.error)}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.deleted.length === 0 && result.failed.length === 0) {
        html += '<p>Nothing to delete.</p>';
    }
    
    container.innerHTML = html;
}

function init() {
    if (!window.__TAURI__) {
        document.body.innerHTML = '<h1 style="color:red;padding:2rem;">Error: Tauri API not available. Make sure withGlobalTauri is set to true in tauri.conf.json and rebuild the app.</h1>';
        return;
    }

    invoke = window.__TAURI__.core.invoke;

    loadConfig().then(() => {
        populateDomainFilter();
        loadAliases();
    });
    
    document.getElementById('domain-filter').addEventListener('change', (e) => {
        selectedDomain = e.target.value;
        renderAliases();
    });
    
    document.getElementById('btn-new').addEventListener('click', () => {
        document.getElementById('alias-modal-title').textContent = 'New Alias';
        document.getElementById('alias-form').reset();
        document.getElementById('alias-id').value = '';
        document.getElementById('alias-to').value = config.default_dest || '';
        showModal('modal-alias');
    });
    
    document.getElementById('btn-sync').addEventListener('click', () => {
        showModal('modal-sync');
        document.getElementById('sync-results').innerHTML = '<p>Choose an action above.</p>';
    });
    
    document.getElementById('btn-pull').addEventListener('click', async () => {
        document.getElementById('sync-results').innerHTML = '<p>Pulling from OVH...</p>';
        try {
            const result = await invoke('sync_with_ovh');
            renderSyncResults(result);
            await loadAliases();
        } catch (e) {
            document.getElementById('sync-results').innerHTML = `<p>Error: ${e}</p>`;
        }
    });
    
    document.getElementById('btn-push').addEventListener('click', async () => {
        document.getElementById('sync-results').innerHTML = '<p>Pushing to OVH...</p>';
        try {
            const result = await invoke('push_to_ovh');
            renderPushResults(result);
            await loadAliases();
        } catch (e) {
            document.getElementById('sync-results').innerHTML = `<p>Error: ${e}</p>`;
        }
    });
    
    document.getElementById('btn-delete-remote').addEventListener('click', async () => {
        if (!confirm('Delete all remote-only aliases from OVH? This cannot be undone.')) return;
        document.getElementById('sync-results').innerHTML = '<p>Deleting from OVH...</p>';
        try {
            const result = await invoke('delete_from_ovh');
            renderDeleteResults(result);
        } catch (e) {
            document.getElementById('sync-results').innerHTML = `<p>Error: ${e}</p>`;
        }
    });
    
    document.getElementById('btn-settings').addEventListener('click', () => {
        populateSettingsForm();
        showModal('modal-settings');
    });

    document.getElementById('btn-api-keys').addEventListener('click', () => {
        apiKeysVisible = true;
        currentTab = 'credentials';
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'credentials');
        });
        document.getElementById('tab-credentials').classList.remove('hidden');
        document.getElementById('tab-applications').classList.add('hidden');
        hideCreateCredentialPanel();
        showModal('modal-api-keys');
        loadCredentials();
    });

    document.querySelectorAll('#modal-api-keys .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            currentTab = tab;
            document.querySelectorAll('#modal-api-keys .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-credentials').classList.toggle('hidden', tab !== 'credentials');
            document.getElementById('tab-applications').classList.toggle('hidden', tab !== 'applications');
            if (tab === 'credentials') {
                loadCredentials();
            } else {
                loadApplications();
            }
        });
    });

    document.getElementById('btn-create-credential').addEventListener('click', showCreateCredentialPanel);
    document.getElementById('btn-cancel-credential').addEventListener('click', hideCreateCredentialPanel);
    document.getElementById('btn-add-rule').addEventListener('click', () => addRuleRow());
    document.getElementById('btn-submit-credential').addEventListener('click', createCredentialWithRules);

    document.getElementById('credentials-list').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'switch') switchCredential(btn.dataset.key);
        else if (action === 'delete') deleteCredential(Number(btn.dataset.id));
    });

    document.getElementById('applications-list').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'delete-app') deleteApplication(Number(btn.dataset.id));
    });

    document.getElementById('search').addEventListener('input', renderAliases);
    
    // Event delegation for Edit/Delete buttons in the aliases table
    document.getElementById('aliases-body').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'edit') editAlias(id);
        else if (action === 'delete') deleteAlias(id);
    });
    
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newConfig = {
            endpoint: document.getElementById('endpoint').value,
            app_key: document.getElementById('app-key').value,
            app_secret: document.getElementById('app-secret').value,
            consumer_key: document.getElementById('consumer-key').value,
            domains: document.getElementById('domains').value.split(',').map(s => s.trim()).filter(s => s),
            default_dest: document.getElementById('default-dest').value,
        };
        
        try {
            await invoke('save_config', { config: newConfig });
            config = newConfig;
            populateDomainFilter();
            hideModal('modal-settings');
        } catch (e) {
            showError('Failed to save settings: ' + e);
        }
    });
    
    document.getElementById('alias-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('alias-id').value;
        const name = document.getElementById('alias-name').value;
        const local = document.getElementById('alias-address').value;
        const domain = document.getElementById('alias-domain').textContent.substring(1);
        const aliasAddr = local + '@' + domain;
        const to = document.getElementById('alias-to').value;
        
        try {
            if (id) {
                await invoke('update_alias', { id, name, aliasAddr, to });
            } else {
                await invoke('create_alias', { name, aliasAddr, to });
            }
            hideModal('modal-alias');
            await loadAliases();
        } catch (e) {
            showError('Failed to save alias: ' + e);
        }
    });
    
    document.getElementById('btn-test-connection').addEventListener('click', async () => {
        const statusEl = document.getElementById('connection-status');
        const infoEl = document.getElementById('credential-info');
        statusEl.textContent = 'Testing...';
        statusEl.className = 'connection-status testing';
        infoEl.classList.add('hidden');

        const testConfig = {
            endpoint: document.getElementById('endpoint').value,
            app_key: document.getElementById('app-key').value,
            app_secret: document.getElementById('app-secret').value,
            consumer_key: document.getElementById('consumer-key').value,
            domains: document.getElementById('domains').value.split(',').map(s => s.trim()).filter(s => s),
            default_dest: document.getElementById('default-dest').value,
        };

        try {
            const result = await invoke('test_ovh_connection', { config: testConfig });
            
            if (result.connected) {
                statusEl.textContent = 'Connected';
                statusEl.className = 'connection-status success';
            } else {
                statusEl.textContent = 'Connection failed';
                statusEl.className = 'connection-status error';
            }

            let html = '';
            if (result.rules.length > 0) {
                html += '<h4>Granted rights:</h4><ul>';
                result.rules.forEach(r => {
                    html += `<li><span class="rule-method">${escapeHtml(r.method)}</span> ${escapeHtml(r.path)}</li>`;
                });
                html += '</ul>';
            }
            if (result.missing_rules.length > 0) {
                html += '<h4 class="text-warning">Missing rights:</h4><ul>';
                result.missing_rules.forEach(r => {
                    html += `<li><span class="rule-method">${escapeHtml(r.method)}</span> ${escapeHtml(r.path)}</li>`;
                });
                html += '</ul>';
                html += '<p class="text-warning">Click "Request Credentials" to generate a new key with the required permissions.</p>';
            } else {
                html += '<p class="text-success">All required permissions are granted.</p>';
            }
            infoEl.innerHTML = html;
            infoEl.classList.remove('hidden');
        } catch (e) {
            statusEl.textContent = 'Error: ' + e;
            statusEl.className = 'connection-status error';
        }
    });
    
    document.getElementById('btn-request-credential').addEventListener('click', async () => {
        const statusEl = document.getElementById('connection-status');
        const infoEl = document.getElementById('credential-info');
        
        if (!document.getElementById('app-key').value || !document.getElementById('app-secret').value) {
            alert('Please fill in Application Key and Application Secret first.');
            return;
        }
        
        if (!confirm('This will generate a new Consumer Key with the required permissions. You will need to open a URL in your browser to approve it. Continue?')) {
            return;
        }
        
        statusEl.textContent = 'Requesting...';
        statusEl.className = 'connection-status testing';
        
        const testConfig = {
            endpoint: document.getElementById('endpoint').value,
            app_key: document.getElementById('app-key').value,
            app_secret: document.getElementById('app-secret').value,
            consumer_key: document.getElementById('consumer-key').value || 'dummy',
            domains: document.getElementById('domains').value.split(',').map(s => s.trim()).filter(s => s),
            default_dest: document.getElementById('default-dest').value,
        };

        try {
            const result = await invoke('request_ovh_credential', { config: testConfig });
            
            let html = '<h4>New Consumer Key</h4>';
            html += `<p><strong>Consumer Key:</strong> <code>${escapeHtml(result.consumer_key)}</code></p>`;
            html += `<p><a href="${escapeHtml(result.validation_url)}" target="_blank" rel="noopener">Click here to approve the key</a></p>`;
            html += '<p class="text-warning">After approving, copy the Consumer Key above into the Consumer Key field and save settings.</p>';
            infoEl.innerHTML = html;
            infoEl.classList.remove('hidden');
            statusEl.textContent = 'Key generated — approve in browser';
            statusEl.className = 'connection-status success';
        } catch (e) {
            statusEl.textContent = 'Error: ' + e;
            statusEl.className = 'connection-status error';
        }
    });
    
    document.getElementById('btn-random').addEventListener('click', async () => {
        try {
            const name = await invoke('generate_random_name');
            document.getElementById('alias-address').value = name;
        } catch (e) {
            console.error('Failed to generate name:', e);
        }
    });
    
    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.add('hidden');
        });
    });
    
    document.querySelectorAll('.btn-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.add('hidden');
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
