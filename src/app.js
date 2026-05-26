let aliases = {};
let config = {};
let invoke;

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
    const searchTerm = document.getElementById('search').value.toLowerCase();
    
    tbody.innerHTML = '';
    
    Object.values(aliases).forEach(alias => {
        if (searchTerm && !matchesSearch(alias, searchTerm)) {
            return;
        }
        
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
            html += `<li>${alias.alias} → ${alias.to}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.remote_only.length > 0) {
        html += `<h3>Remote only (${result.remote_only.length})</h3><ul>`;
        result.remote_only.forEach(alias => {
            html += `<li>${alias.alias} → ${alias.to}</li>`;
        });
        html += '</ul>';
    }
    
    if (result.local_only.length === 0 && result.remote_only.length === 0) {
        html += '<p>In sync!</p>';
    }
    
    container.innerHTML = html;
}

function init() {
    if (!window.__TAURI__) {
        document.body.innerHTML = '<h1 style="color:red;padding:2rem;">Error: Tauri API not available. Make sure withGlobalTauri is set to true in tauri.conf.json and rebuild the app.</h1>';
        return;
    }

    invoke = window.__TAURI__.core.invoke;

    loadConfig();
    loadAliases();
    
    document.getElementById('btn-new').addEventListener('click', () => {
        document.getElementById('alias-modal-title').textContent = 'New Alias';
        document.getElementById('alias-form').reset();
        document.getElementById('alias-id').value = '';
        showModal('modal-alias');
    });
    
    document.getElementById('btn-sync').addEventListener('click', async () => {
        showModal('modal-sync');
        document.getElementById('sync-results').innerHTML = '<p>Syncing...</p>';
        
        try {
            const result = await invoke('sync_with_ovh');
            renderSyncResults(result);
            await loadAliases();
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
                await invoke('update_alias', { id, name, alias_addr: aliasAddr, to });
            } else {
                await invoke('create_alias', { name, alias_addr: aliasAddr, to });
            }
            hideModal('modal-alias');
            await loadAliases();
        } catch (e) {
            showError('Failed to save alias: ' + e);
        }
    });
    
    document.getElementById('btn-test-connection').addEventListener('click', async () => {
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = 'Testing...';
        statusEl.className = 'connection-status testing';

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
            statusEl.textContent = result;
            statusEl.className = 'connection-status ' + (result.startsWith('Connected') ? 'success' : 'error');
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
