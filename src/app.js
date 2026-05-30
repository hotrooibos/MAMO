let aliases = {};
let config = {};
let invoke;
let selectedDomain = '';

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
