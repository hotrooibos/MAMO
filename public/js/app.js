(function () {
  'use strict';

  // ===== State ====
  var data = window.__INITIAL_DATA__ || { aliases: [], domains: [], dictionary: { prefixes: [], suffixes: [] } };
  var editAliasId = null; // null = mode création
  var lastFocusedElement = null; // pour restauration focus
  var currentDomain = ''; // filtre domaine actif ('' = tous)
  var recentGenerations = []; // 3 dernières générations pour éviter répétitions
  var sortState = { column: null, dir: null }; // état du tri des colonnes
  var searchTimeout = null; // debounce pour la recherche

  // ===== Theme =====
  var html = document.documentElement;
  var themeToggle = document.getElementById('theme-toggle');
  var themeIcon = document.getElementById('theme-icon');
  var STORAGE_KEY = 'mam-theme';

  function getTheme() {
    return html.classList.contains('theme-dark') ? 'dark' : 'light';
  }

  function setTheme(theme) {
    html.classList.remove('theme-light', 'theme-dark');
    html.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }

  setTheme(getTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // ===== Escape HTML =====
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ===== Toast system =====
  var toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  function showToast(message, type) {
    type = type || 'success';
    var colors = {
      success: 'bg-green/10 text-green border-green/30',
      error: 'bg-red/10 text-red border-red/30',
      warning: 'bg-orange/10 text-orange border-orange/30',
    };
    var icons = { success: '✓', error: '✗', warning: '⚠' };

    var el = document.createElement('div');
    el.className = 'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded border text-sm shadow-lg transition-all duration-300 ' + (colors[type] || colors.success);
    el.style.minWidth = '280px';
    el.style.maxWidth = '420px';
    el.innerHTML = '<span class="font-bold shrink-0">' + (icons[type] || '') + '</span><span class="flex-1">' + escapeHtml(message) + '</span><button class="ml-2 text-current opacity-60 hover:opacity-100 cursor-pointer bg-transparent border-none text-lg leading-none">&times;</button>';

    el.querySelector('button').addEventListener('click', function () {
      el.remove();
    });

    toastContainer.appendChild(el);

    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 4000);

    while (toastContainer.children.length > 3) {
      toastContainer.firstChild.remove();
    }
  }

  // ===== Status badge avec jours restants =====
  function renderStatusBadge(alias) {
    if (alias.tempExpires) {
      var daysLeft = Math.ceil((new Date(alias.tempExpires) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) {
        return '<span class="inline-block px-1.5 py-0.5 text-xs rounded bg-red/10 text-red">Expiré</span>';
      } else if (daysLeft <= 7) {
        return '<span class="inline-block px-1.5 py-0.5 text-xs rounded bg-orange/10 text-orange">Temp. ' + daysLeft + 'j</span>';
      } else {
        return '<span class="inline-block px-1.5 py-0.5 text-xs rounded bg-green/10 text-green">Temp. ' + daysLeft + 'j</span>';
      }
    } else if (alias.active) {
      return '<span class="inline-block px-1.5 py-0.5 text-xs rounded bg-green/10 text-green">Actif</span>';
    } else {
      return '<span class="inline-block px-1.5 py-0.5 text-xs rounded bg-red/10 text-red">Inactif</span>';
    }
  }

  // ===== Render alias row =====
  function renderAliasRow(alias) {
    var tagsHtml = '';
    if (Array.isArray(alias.tags) && alias.tags.length > 0) {
      tagsHtml = '<div class="flex flex-wrap gap-1">';
      alias.tags.forEach(function (t) {
        tagsHtml += '<span class="inline-block px-1.5 py-0.5 text-xs rounded bg-blue/10 text-blue">' + escapeHtml(t) + '</span>';
      });
      tagsHtml += '</div>';
    } else {
      tagsHtml = '<span class="text-text-secondary text-xs">—</span>';
    }

    function fmt(d) {
      if (!d) return '—';
      try {
        var dt = new Date(d);
        return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR');
      } catch { return '—'; }
    }

    var desc = alias.description ? escapeHtml(alias.description) : '—';

    return '<tr class="border-t border-border hover:bg-surface-muted/50 transition-colors cursor-pointer alias-row" data-alias=\'' + JSON.stringify(alias).replace(/</g, '\\u003c') + '\'>' +
      '<td class="px-3 py-2.5 max-w-[200px] truncate">' + desc + '</td>' +
      '<td class="px-3 py-2.5 font-mono text-xs">' + escapeHtml(alias.from) + '<span class="text-text-secondary">@' + escapeHtml(alias.domain) + '</span></td>' +
      '<td class="px-3 py-2.5 font-mono text-xs hidden sm:table-cell max-w-[200px] truncate">' + escapeHtml(alias.to) + '</td>' +
      '<td class="px-3 py-2.5 hidden md:table-cell">' + tagsHtml + '</td>' +
      '<td class="px-3 py-2.5">' + renderStatusBadge(alias) + '</td>' +
      '<td class="px-3 py-2.5 text-text-secondary text-xs hidden lg:table-cell">' + fmt(alias.createdAt) + '</td>' +
      '<td class="px-3 py-2.5 text-text-secondary text-xs hidden lg:table-cell">' + fmt(alias.updatedAt) + '</td>' +
      '</tr>';
  }

  // ===== Modal elements =====
  var modal = document.getElementById('alias-modal');
  var overlay = document.getElementById('modal-overlay');
  var modalTitle = document.getElementById('modal-title');
  var modalError = document.getElementById('modal-error');
  var fieldFrom = document.getElementById('field-from');
  var fieldDomain = document.getElementById('field-domain');
  var fieldTo = document.getElementById('field-to');
  var fieldDescription = document.getElementById('field-description');
  var fieldTags = document.getElementById('field-tags');
  var statusRadios = document.querySelectorAll('input[name="status"]');
  var tempDurationGroup = document.getElementById('temp-duration-group');
  var fieldTempDuration = document.getElementById('field-temp-duration');
  var fromReadonlyHint = document.getElementById('from-readonly-hint');

  // Normal actions (create)
  var modalActions = document.getElementById('modal-actions');
  var cancelBtn = document.getElementById('modal-cancel');
  var saveBtn = document.getElementById('modal-save');

  // Edit actions
  var modalActionsEdit = document.getElementById('modal-actions-edit');
  var cancelEditBtn = document.getElementById('modal-cancel-edit');
  var saveEditBtn = document.getElementById('modal-save-edit');
  var deleteBtn = document.getElementById('modal-delete');

  // Delete confirm
  var modalDeleteConfirm = document.getElementById('modal-delete-confirm');
  var deleteCancelBtn = document.getElementById('modal-delete-cancel');
  var deleteConfirmBtn = document.getElementById('modal-delete-confirm-btn');

  // Force delete
  var modalForceDelete = document.getElementById('modal-force-delete');
  var forceCancelBtn = document.getElementById('modal-force-cancel');
  var forceConfirmBtn = document.getElementById('modal-force-confirm-btn');

  // ===== Modal helpers =====
  function resetModalView() {
    modalError.classList.add('hidden');
    modalActions.classList.remove('hidden');
    modalActionsEdit.classList.add('hidden');
    modalDeleteConfirm.classList.add('hidden');
    modalForceDelete.classList.add('hidden');
    fromReadonlyHint.classList.add('hidden');
    fieldFrom.readOnly = false;
    fieldFrom.classList.remove('bg-surface-muted', 'cursor-not-allowed');
  }

  function hideAllSections() {
    modalActions.classList.add('hidden');
    modalActionsEdit.classList.add('hidden');
    modalDeleteConfirm.classList.add('hidden');
    modalForceDelete.classList.add('hidden');
  }

  // ===== Open modal in create mode =====
  function openModal() {
    editAliasId = null;
    modalTitle.textContent = 'Nouvel alias';
    resetModalView();
    modal.classList.remove('hidden');

    fieldFrom.value = '';
    fieldFrom.readOnly = false;
    fieldFrom.classList.remove('bg-surface-muted', 'cursor-not-allowed');
    fieldTo.value = data.defaultTo || '';
    fieldDescription.value = '';
    fieldTags.value = '';
    document.querySelectorAll('input[name="status"]').forEach(function (r) {
      if (r.value === 'active') r.checked = true;
    });
    tempDurationGroup.classList.add('hidden');

    // Pré-sélectionner le domaine actif du filtre
    if (currentDomain && fieldDomain) {
      for (var di = 0; di < fieldDomain.options.length; di++) {
        if (fieldDomain.options[di].value === currentDomain) {
          fieldDomain.selectedIndex = di;
          break;
        }
      }
    }

    saveFocus();
    enableFocusTrap(modal);
    fieldFrom.focus();
  }

  // ===== Open modal in edit mode =====
  function openEditModal(alias) {
    editAliasId = alias.id;
    modalTitle.textContent = 'Modifier l\'alias';
    resetModalView();

    // Hide create actions, show edit actions
    modalActions.classList.add('hidden');
    modalActionsEdit.classList.remove('hidden');

    // Pre-fill fields
    fieldFrom.value = alias.from;
    fieldFrom.readOnly = true;
    fieldFrom.classList.add('bg-surface-muted', 'cursor-not-allowed');
    fromReadonlyHint.classList.remove('hidden');

    // Domain - set value if in list
    var domainExists = false;
    for (var i = 0; i < fieldDomain.options.length; i++) {
      if (fieldDomain.options[i].value === alias.domain) {
        fieldDomain.selectedIndex = i;
        domainExists = true;
        break;
      }
    }
    if (!domainExists && data.domains.length > 0) {
      fieldDomain.selectedIndex = 0;
    }

    fieldTo.value = alias.to || '';
    fieldDescription.value = alias.description || '';

    // Tags
    if (Array.isArray(alias.tags) && alias.tags.length > 0) {
      fieldTags.value = alias.tags.join(', ');
    } else {
      fieldTags.value = '';
    }

    // Status
    if (alias.tempExpires) {
      document.querySelectorAll('input[name="status"]').forEach(function (r) {
        r.checked = r.value === 'temporary';
      });
      tempDurationGroup.classList.remove('hidden');
      // Set temp duration from existing expiry (approximate)
      if (alias.tempExpires) {
        var now = new Date();
        var exp = new Date(alias.tempExpires);
        var days = Math.round((exp - now) / (1000 * 60 * 60 * 24));
        if (days > 0 && fieldTempDuration) {
          fieldTempDuration.value = String(days);
        }
      }
    } else if (alias.active) {
      document.querySelectorAll('input[name="status"]').forEach(function (r) {
        r.checked = r.value === 'active';
      });
      tempDurationGroup.classList.add('hidden');
    } else {
      document.querySelectorAll('input[name="status"]').forEach(function (r) {
        r.checked = r.value === 'inactive';
      });
      tempDurationGroup.classList.add('hidden');
    }

    saveFocus();
    enableFocusTrap(modal);
    modal.classList.remove('hidden');
    fieldTo.focus();
  }

  // ===== Close modal =====
  function closeModal() {
    modal.classList.add('hidden');
    editAliasId = null;
    disableFocusTrap();
    restoreFocus();
  }

  // ===== Modal openers =====
  document.getElementById('btn-new-alias').addEventListener('click', openModal);

  var emptyCreateBtn = document.getElementById('empty-create-btn');
  if (emptyCreateBtn) {
    emptyCreateBtn.addEventListener('click', openModal);
  }

  // ===== Row click → edit =====
  document.getElementById('alias-tbody').addEventListener('click', function (e) {
    var row = e.target.closest('.alias-row');
    if (!row) return;
    try {
      var alias = JSON.parse(row.getAttribute('data-alias'));
      openEditModal(alias);
    } catch (err) {
      console.error('[MAM] Failed to parse alias data', err);
    }
  });

  // ===== Focus trap helpers =====
  function saveFocus() {
    lastFocusedElement = document.activeElement;
  }

  function restoreFocus() {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      try { lastFocusedElement.focus(); } catch { /* ignore */ }
    }
    lastFocusedElement = null;
  }

  var focusTrapHandler = null;

  function getFocusables(container) {
    return container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  }

  function enableFocusTrap(container) {
    if (focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
    }
    focusTrapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var focusables = getFocusables(container);
      if (focusables.length === 0) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', focusTrapHandler);
    // Focus le premier élément focusable
    var firstFocusable = getFocusables(container)[0];
    if (firstFocusable) setTimeout(function () { firstFocusable.focus(); }, 50);
  }

  function disableFocusTrap() {
    if (focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
      focusTrapHandler = null;
    }
  }

  // ===== Close handlers =====
  function closeAll() {
    closeModal();
  }

  if (cancelBtn) cancelBtn.addEventListener('click', closeAll);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeAll);
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAll();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeAll();
    }
  });

  // ===== Status radio toggle temp duration =====
  statusRadios.forEach(function (r) {
    r.addEventListener('change', function () {
      tempDurationGroup.classList.toggle('hidden', this.value !== 'temporary');
    });
  });

  // ===== Form data builder =====
  function getFormData() {
    var from = fieldFrom ? fieldFrom.value.trim() : '';
    var domain = fieldDomain ? fieldDomain.value : (data.domains[0] || '');
    var to = fieldTo ? fieldTo.value.trim() : '';
    var description = fieldDescription ? fieldDescription.value.trim() : '';
    var tagsRaw = fieldTags ? fieldTags.value.trim() : '';
    var tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];

    var statusValue = 'active';
    document.querySelectorAll('input[name="status"]').forEach(function (r) {
      if (r.checked) statusValue = r.value;
    });

    var active = statusValue !== 'inactive';
    var tempExpires = null;
    if (statusValue === 'temporary') {
      var days = parseInt(fieldTempDuration ? fieldTempDuration.value : '30', 10);
      var d = new Date();
      d.setDate(d.getDate() + days);
      tempExpires = d.toISOString();
    }

    return { domain: domain, from: from, to: to, description: description, tags: tags, active: active, tempExpires: tempExpires };
  }

  // ===== Save / Create =====
  saveBtn.addEventListener('click', async function () {
    var data = getFormData();
    if (!data.from) { showModalError('Le champ From est requis'); return; }
    if (!data.to) { showModalError('Le champ Destination est requis'); return; }
    if (data.to.indexOf('@') === -1) { showModalError('Destination doit être une adresse email valide'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement…';

    try {
      var resp = await fetch('/api/aliases/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      var result = await resp.json();

      if (result.success) {
        closeModal();
        var tbody = document.getElementById('alias-tbody');
        var emptyRow = document.getElementById('empty-state-row');
        if (emptyRow) emptyRow.remove();
        if (tbody) {
          tbody.insertAdjacentHTML('afterbegin', renderAliasRow(result.data));
        }
        window.__INITIAL_DATA__.aliases.unshift(result.data);
        // Re-apply filters and sort
        applyFilters();
        applySort();
        showToast('Alias créé sur OVH', 'success');
      } else {
        var errMsg = result.error || 'Erreur inconnue';
        if (resp.status === 400) {
          showModalError(errMsg);
        } else {
          showToast(errMsg, 'error');
        }
      }
    } catch (err) {
      showToast('Erreur réseau : ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Sauvegarder';
    }
  });

  // ===== Save / Edit =====
  saveEditBtn.addEventListener('click', async function () {
    var fd = getFormData();
    if (!fd.to) { showModalError('Le champ Destination est requis'); return; }
    if (fd.to.indexOf('@') === -1) { showModalError('Destination doit être une adresse email valide'); return; }

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'Enregistrement…';

    try {
      var resp = await fetch('/api/aliases/ui/' + encodeURIComponent(editAliasId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: fd.to,
          description: fd.description,
          tags: fd.tags,
          active: fd.active,
          tempExpires: fd.tempExpires,
        }),
      });

      var result = await resp.json();

      if (result.success) {
        closeModal();
        // Replace row in table
        var tbody = document.getElementById('alias-tbody');
        var rows = tbody.querySelectorAll('.alias-row');
        rows.forEach(function (row) {
          try {
            var rowData = JSON.parse(row.getAttribute('data-alias'));
            if (rowData.id === result.data.id) {
              row.outerHTML = renderAliasRow(result.data);
            }
          } catch (e) { /* skip invalid rows */ }
        });

        // Update data
        var idx = window.__INITIAL_DATA__.aliases.findIndex(function (a) { return a.id === result.data.id; });
        if (idx !== -1) window.__INITIAL_DATA__.aliases[idx] = result.data;

        // Re-apply filters and sort
        applyFilters();
        applySort();

        showToast('Alias mis à jour', 'success');
      } else {
        var errMsg = result.error || 'Erreur inconnue';
        if (resp.status === 400) {
          showModalError(errMsg);
        } else {
          showToast(errMsg, 'error');
        }
      }
    } catch (err) {
      showToast('Erreur réseau : ' + err.message, 'error');
    } finally {
      saveEditBtn.disabled = false;
      saveEditBtn.textContent = 'Sauvegarder';
    }
  });

  // ===== Delete flow =====
  var pendingDeleteId = null;

  deleteBtn.addEventListener('click', function () {
    hideAllSections();
    modalDeleteConfirm.classList.remove('hidden');
    pendingDeleteId = editAliasId;
  });

  deleteCancelBtn.addEventListener('click', function () {
    // Back to edit view
    hideAllSections();
    modalActionsEdit.classList.remove('hidden');
    pendingDeleteId = null;
  });

  deleteConfirmBtn.addEventListener('click', async function () {
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Suppression…';

    try {
      var resp = await fetch('/api/aliases/ui/' + encodeURIComponent(pendingDeleteId), {
        method: 'DELETE',
      });

      if (resp.ok) {
        // Success
        closeModal();
        var tbody = document.getElementById('alias-tbody');
        var rows = tbody.querySelectorAll('.alias-row');
        rows.forEach(function (row) {
          try {
            var rowData = JSON.parse(row.getAttribute('data-alias'));
            if (rowData.id === pendingDeleteId) {
              row.remove();
            }
          } catch (e) { /* skip */ }
        });

        var idx = window.__INITIAL_DATA__.aliases.findIndex(function (a) { return a.id === pendingDeleteId; });
        if (idx !== -1) window.__INITIAL_DATA__.aliases.splice(idx, 1);

        // Show empty state if no aliases left
        if (window.__INITIAL_DATA__.aliases.length === 0) {
          var tbodyEl = document.getElementById('alias-tbody');
          if (tbodyEl && !document.getElementById('empty-state-row')) {
            tbodyEl.innerHTML = '<tr id="empty-state-row"><td colspan="7" class="px-3 py-16 text-center"><div class="flex flex-col items-center gap-3"><p class="text-text-secondary">Aucun alias pour ce domaine</p><button id="empty-create-btn" class="inline-flex items-center gap-1 text-blue hover:underline text-sm cursor-pointer bg-transparent border-none"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Créer un alias</button></div></td></tr>';
            document.getElementById('empty-create-btn').addEventListener('click', openModal);
          }
        }

        showToast('Alias supprimé sur OVH', 'success');
      } else {
        // Error - likely OVH failure
        var result;
        try { result = await resp.json(); } catch { result = {}; }

        hideAllSections();
        modalForceDelete.classList.remove('hidden');
        // Keep modal open with force delete option
      }
    } catch (err) {
      showToast('Erreur réseau : ' + err.message, 'error');
      hideAllSections();
      modalActionsEdit.classList.remove('hidden');
    } finally {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Confirmer la suppression';
    }
  });

  // ===== Force delete (OVH failure) =====
  forceConfirmBtn.addEventListener('click', async function () {
    forceConfirmBtn.disabled = true;
    forceConfirmBtn.textContent = 'Suppression…';

    try {
      var resp = await fetch('/api/aliases/ui/' + encodeURIComponent(pendingDeleteId) + '?force=true', {
        method: 'DELETE',
      });

      if (resp.ok) {
        closeModal();
        // Same removal logic as above
        var tbody = document.getElementById('alias-tbody');
        var rows = tbody.querySelectorAll('.alias-row');
        rows.forEach(function (row) {
          try {
            var rowData = JSON.parse(row.getAttribute('data-alias'));
            if (rowData.id === pendingDeleteId) row.remove();
          } catch (e) { /* skip */ }
        });

        var idx = window.__INITIAL_DATA__.aliases.findIndex(function (a) { return a.id === pendingDeleteId; });
        if (idx !== -1) window.__INITIAL_DATA__.aliases.splice(idx, 1);

        showToast('Alias supprimé localement', 'success');
      } else {
        showToast('Impossible de supprimer l\'alias', 'error');
        closeModal();
      }
    } catch (err) {
      showToast('Erreur réseau : ' + err.message, 'error');
      closeModal();
    } finally {
      forceConfirmBtn.disabled = false;
      forceConfirmBtn.textContent = 'Forcer la suppression locale';
    }
  });

  forceCancelBtn.addEventListener('click', function () {
    hideAllSections();
    modalActionsEdit.classList.remove('hidden');
    pendingDeleteId = null;
  });

  // ===== Modal error =====
  function showModalError(msg) {
    if (modalError) {
      modalError.textContent = msg;
      modalError.classList.remove('hidden');
    }
  }

  // ===== Sync =====
  var progressBar = document.getElementById('sync-progress');
  var syncBtn = document.getElementById('btn-sync');
  var syncLabel = document.getElementById('sync-label');
  var syncTime = document.getElementById('sync-time');
  var discrepancyModal = document.getElementById('discrepancy-modal');
  var discrepancyBody = document.getElementById('discrepancy-body');
  var discrepancyTime = document.getElementById('discrepancy-time');
  var discrepancyClose = document.getElementById('discrepancy-close');
  var discrepancyOverlay = document.getElementById('discrepancy-overlay');
  var discrepancySyncAll = document.getElementById('discrepancy-sync-all');

  function showProgress() {
    if (progressBar) progressBar.classList.remove('hidden');
    if (syncLabel) syncLabel.textContent = 'Sync…';
  }

  function hideProgress() {
    if (progressBar) progressBar.classList.add('hidden');
    if (syncLabel) syncLabel.textContent = 'Sync';
  }

  function updateSyncTime(lastSyncAt) {
    if (!syncTime) return;
    if (!lastSyncAt) {
      syncTime.classList.add('hidden');
      syncTime.textContent = '—';
      return;
    }
    var now = new Date();
    var last = new Date(lastSyncAt);
    var diffMs = now - last;
    var minutes = Math.floor(diffMs / 60000);
    var text = minutes < 1 ? 'À l\'instant' : 'Il y a ' + minutes + ' min';
    if (minutes >= 60) {
      var hours = Math.floor(minutes / 60);
      text = 'Il y a ' + hours + 'h';
    }
    syncTime.textContent = text;
    syncTime.classList.remove('hidden');
  }

  function buildSectionHtml(title, items, type) {
    if (!items || items.length === 0) return '';
    var html = '<div class="space-y-2">';
    html += '<h3 class="text-sm font-semibold text-text-secondary">' + escapeHtml(title) + ' (' + items.length + ')</h3>';
    html += '<div class="space-y-1">';
    items.forEach(function (item) {
      var label = item.from + '@' + item.domain + ' → ' + item.to;
      if (type === 'localOnly') {
        html += '<div class="flex items-center gap-2 text-xs py-1 px-2 rounded bg-orange/5 border border-orange/20">';
        html += '<span class="text-orange font-bold shrink-0">Local</span>';
        html += '<span class="font-mono text-text-primary">' + escapeHtml(label) + '</span>';
        if (item.description) html += '<span class="text-text-muted truncate">— ' + escapeHtml(item.description) + '</span>';
        html += '</div>';
      } else if (type === 'ovhOnly') {
        html += '<div class="flex items-center gap-2 text-xs py-1 px-2 rounded bg-blue/5 border border-blue/20">';
        html += '<span class="text-blue font-bold shrink-0">OVH</span>';
        html += '<span class="font-mono text-text-primary">' + escapeHtml(label) + '</span>';
        html += '</div>';
      } else {
        html += '<div class="flex items-center gap-2 text-xs py-1 px-2 rounded bg-green/5 border border-green/20">';
        html += '<span class="text-green font-bold shrink-0">✓</span>';
        html += '<span class="font-mono text-text-primary">' + escapeHtml(label) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function openDiscrepancyModal(report) {
    if (!discrepancyModal || !discrepancyBody) return;

    var html = '';

    if (report.localOnly && report.localOnly.length > 0) {
      html += buildSectionHtml('Alias locaux uniquement', report.localOnly, 'localOnly');
    }
    if (report.ovhOnly && report.ovhOnly.length > 0) {
      html += buildSectionHtml('Alias OVH uniquement', report.ovhOnly, 'ovhOnly');
    }
    if (report.synced && report.synced.length > 0) {
      html += buildSectionHtml('Alias synchronisés', report.synced, 'synced');
    }

    if (!html) {
      html = '<p class="text-sm text-text-secondary text-center py-4">Aucun écart détecté. Tout est synchronisé.</p>';
    }

    discrepancyBody.innerHTML = html;
    if (discrepancyTime && report.timestamp) {
      var d = new Date(report.timestamp);
      discrepancyTime.textContent = d.toLocaleTimeString('fr-FR');
    }
    saveFocus();
    enableFocusTrap(discrepancyModal);
    discrepancyModal.classList.remove('hidden');
  }

  function closeDiscrepancyModal() {
    if (discrepancyModal) discrepancyModal.classList.add('hidden');
    disableFocusTrap();
    restoreFocus();
  }

  // Sync button click
  if (syncBtn) {
    syncBtn.addEventListener('click', async function () {
      showProgress();
      try {
        var resp = await fetch('/api/aliases/ui/sync', { method: 'POST' });
        var result = await resp.json();
        hideProgress();

        if (result.success) {
          updateSyncTime(result.data.timestamp);
          // Check if there are any differences
          var totalDiff = (result.data.localOnly || []).length + (result.data.ovhOnly || []).length;
          if (totalDiff > 0) {
            openDiscrepancyModal(result.data);
          } else {
            showToast('Tout est synchronisé', 'success');
          }
          // Rafraîchir la page pour refléter les changements
          location.reload();
        } else {
          showToast('Erreur de synchronisation : ' + (result.error || 'Inconnue'), 'error');
        }
      } catch (err) {
        hideProgress();
        showToast('Erreur réseau : ' + err.message, 'error');
      }
    });
  }

  // Discrepancy modal close
  if (discrepancyClose) discrepancyClose.addEventListener('click', closeDiscrepancyModal);
  if (discrepancyOverlay) {
    discrepancyOverlay.addEventListener('click', function (e) {
      if (e.target === discrepancyOverlay) closeDiscrepancyModal();
    });
  }

  // Sync all button in discrepancy modal
  if (discrepancySyncAll) {
    discrepancySyncAll.addEventListener('click', function () {
      closeDiscrepancyModal();
      showToast('Sync terminée', 'success');
    });
  }

  // Poll sync status every 30s
  function pollSyncStatus() {
    fetch('/api/aliases/ui/sync-status')
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (result.success && result.data) {
          if (result.data.isSyncing) {
            showProgress();
          } else {
            hideProgress();
            updateSyncTime(result.data.lastSyncAt);
          }
        }
      })
      .catch(function () { /* ignore poll errors */ });
  }

  // Initial poll
  pollSyncStatus();
  // Then every 30s
  setInterval(pollSyncStatus, 30000);

  // ===== Domain filter =====
  var domainFilter = document.getElementById('domain-filter');
  var searchInput = document.getElementById('search-input');
  var searchClearBtn = document.getElementById('search-clear-btn');

  function getSearchText(rowData) {
    return ((rowData.from || '') + ' ' +
      (rowData.domain || '') + ' ' +
      (rowData.to || '') + ' ' +
      (rowData.description || '') + ' ' +
      (Array.isArray(rowData.tags) ? rowData.tags.join(' ') : '')).toLowerCase();
  }

  // ===== Unified filter (domaine + recherche en un seul passage) =====
  function applyFilters() {
    var domain = domainFilter ? domainFilter.value : '';
    currentDomain = domain || '';

    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var searchActive = query.length > 0;

    // Toggle clear button visibility
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('hidden', !searchActive);
    }

    var tbody = document.getElementById('alias-tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('.alias-row');
    var visibleCount = 0;
    var totalAliasRows = rows.length;

    rows.forEach(function (row) {
      try {
        var rowData = JSON.parse(row.getAttribute('data-alias'));

        // Filtre domaine
        var domainMatch = !domain || rowData.domain === domain;

        // Filtre recherche
        var searchMatch = !searchActive || getSearchText(rowData).indexOf(query) !== -1;

        if (domainMatch && searchMatch) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      } catch (e) {
        row.style.display = '';
        visibleCount++;
      }
    });

    updateSearchEmptyState(searchActive && visibleCount === 0 && totalAliasRows > 0);
    updateAliasCount(visibleCount, totalAliasRows);
  }

  function updateAliasCount(visible, total) {
    var el = document.getElementById('alias-count');
    if (!el) return;
    el.textContent = visible === total ? String(total) : visible + '/' + total;
  }

  function updateSearchEmptyState(show) {
    var existing = document.getElementById('search-empty-state');
    if (existing) existing.remove();

    if (!show) return;

    var tbody = document.getElementById('alias-tbody');
    if (!tbody) return;

    var tr = document.createElement('tr');
    tr.id = 'search-empty-state';
    tr.innerHTML = '<td colspan="7" class="px-3 py-16 text-center">' +
      '<p class="text-text-secondary text-sm">Aucun alias ne correspond à votre recherche</p>' +
      '<p class="text-text-muted text-xs mt-1">' +
      'Essayez un autre terme ou <button id="search-empty-clear" class="text-blue hover:underline bg-transparent border-none cursor-pointer text-xs">effacez la recherche</button>' +
      '</p></td>';
    tbody.appendChild(tr);

    var clearBtn = document.getElementById('search-empty-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.focus();
        }
      });
    }
  }

  if (domainFilter) {
    // Restaurer depuis sessionStorage
    var saved = sessionStorage.getItem('mam-domain-filter');
    if (saved) {
      for (var di = 0; di < domainFilter.options.length; di++) {
        if (domainFilter.options[di].value === saved) {
          domainFilter.selectedIndex = di;
          break;
        }
      }
    }

    applyFilters();
    applySort();

    domainFilter.addEventListener('change', function () {
      var val = domainFilter.value;
      try { sessionStorage.setItem('mam-domain-filter', val); } catch { /* ignore */ }
      applyFilters();
      applySort();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () {
        applyFilters();
        applySort();
      }, 150);
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchInput.blur();
        applyFilters();
        applySort();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', function () {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        applyFilters();
        applySort();
      }
    });
  }

  // ===== Column sort =====
  var sortHeaders = document.querySelectorAll('th[data-sort]');

  function getSortValue(rowData, column) {
    if (column === 'status') {
      if (rowData.tempExpires) return '1_' + rowData.tempExpires;
      if (rowData.active) return '0_';
      return '2_';
    }
    if (column === 'tags') {
      return (Array.isArray(rowData.tags) ? rowData.tags.join(', ') : '').toLowerCase();
    }
    if (column === 'createdAt' || column === 'updatedAt') {
      return new Date(rowData[column] || 0).getTime();
    }
    return (rowData[column] || '').toString().toLowerCase();
  }

  function applySort() {
    if (!sortState.column || !sortState.dir) return;

    var tbody = document.getElementById('alias-tbody');
    if (!tbody) return;
    var allRows = Array.from(tbody.querySelectorAll('.alias-row'));
    var rows = allRows.filter(function (r) { return r.style.display !== 'none'; });
    var hidden = allRows.filter(function (r) { return r.style.display === 'none'; });

    rows.sort(function (a, b) {
      var aData, bData;
      try { aData = JSON.parse(a.getAttribute('data-alias')); } catch (e) { return 0; }
      try { bData = JSON.parse(b.getAttribute('data-alias')); } catch (e) { return 0; }

      var aVal = getSortValue(aData, sortState.column);
      var bVal = getSortValue(bData, sortState.column);

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortState.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      var cmp = String(aVal).localeCompare(String(bVal));
      return sortState.dir === 'asc' ? cmp : -cmp;
    });

    // Re-append rows in sorted order
    rows.forEach(function (r) { tbody.appendChild(r); });
    hidden.forEach(function (r) { tbody.appendChild(r); });
  }

  function updateSortIndicators() {
    sortHeaders.forEach(function (th) {
      var col = th.getAttribute('data-sort');
      var indicator = th.querySelector('.sort-indicator');
      if (!indicator) return;

      if (sortState.column === col && sortState.dir) {
        indicator.textContent = sortState.dir === 'asc' ? ' ▲' : ' ▼';
        th.setAttribute('aria-sort', sortState.dir === 'asc' ? 'ascending' : 'descending');
      } else {
        indicator.textContent = '';
        th.setAttribute('aria-sort', 'none');
      }
    });
  }

  sortHeaders.forEach(function (th) {
    th.addEventListener('click', function () {
      var col = this.getAttribute('data-sort');

      if (sortState.column === col) {
        // Cycle: asc → desc → none
        if (sortState.dir === 'asc') {
          sortState.dir = 'desc';
        } else if (sortState.dir === 'desc') {
          sortState.column = null;
          sortState.dir = null;
        }
      } else {
        sortState.column = col;
        sortState.dir = 'asc';
      }

      updateSortIndicators();
      applySort();
    });

    // Keyboard support
    th.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });

  // Apply sort indicators on init
  updateSortIndicators();

  // ===== Generator =====
  var btnGenerate = document.getElementById('btn-generate');
  var genLang = document.getElementById('gen-lang');

  function pickWord(list, lang) {
    if (!list || list.length === 0) return null;
    var item = list[Math.floor(Math.random() * list.length)];
    if (!item) return null;
    return item[lang] || item.fr || item.en || item.es || Object.values(item)[0] || null;
  }

  function generateFromClient() {
    var dict = data.dictionary;
    if (!dict || !Array.isArray(dict.prefixes) || !Array.isArray(dict.suffixes) || dict.prefixes.length === 0 || dict.suffixes.length === 0) {
      showToast('Dictionnaire vide', 'error');
      return null;
    }

    var lang = genLang ? genLang.value : 'mashup';
    if (lang === 'mashup') {
      var langs = ['fr', 'en', 'es'];
      lang = langs[Math.floor(Math.random() * langs.length)];
    }

    // Collect existing from addresses for collision check
    var usedFroms = {};
    if (Array.isArray(data.aliases)) {
      data.aliases.forEach(function (a) {
        usedFroms[(a.from || '').toLowerCase()] = true;
      });
    }
    recentGenerations.forEach(function (r) { usedFroms[r.toLowerCase()] = true; });

    for (var attempt = 0; attempt < 5; attempt++) {
      var prefix = pickWord(dict.prefixes, lang);
      var suffix = pickWord(dict.suffixes, lang);
      if (!prefix || !suffix) break;
      var from = (prefix + '-' + suffix).toLowerCase();

      if (usedFroms[from]) continue;

      // Track recent generations (keep last 3)
      recentGenerations.push(from);
      if (recentGenerations.length > 3) recentGenerations.shift();

      return from;
    }

    showToast('Impossible de générer un alias unique', 'error');
    return null;
  }

  if (btnGenerate && fieldFrom) {
    btnGenerate.addEventListener('click', function () {
      var from = generateFromClient();
      if (from) {
        fieldFrom.value = from;
        fieldFrom.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  // ===== Quick alias =====
  var btnQuickAlias = document.getElementById('btn-quick-alias');
  var quickAliasForm = document.getElementById('quick-alias-form');
  var quickAliasTo = document.getElementById('quick-alias-to');
  var quickAliasSubmit = document.getElementById('quick-alias-submit');

  if (btnQuickAlias && quickAliasForm) {
    btnQuickAlias.addEventListener('click', function () {
      quickAliasForm.classList.toggle('hidden');
      if (!quickAliasForm.classList.contains('hidden')) {
        if (!quickAliasTo.value) quickAliasTo.value = data.defaultTo || '';
        setTimeout(function () { quickAliasTo.focus(); }, 100);
      }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!quickAliasForm.classList.contains('hidden') &&
          !e.target.closest('#quick-alias-container')) {
        quickAliasForm.classList.add('hidden');
      }
    });

    // Submit on enter
    quickAliasTo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') quickAliasSubmit.click();
      if (e.key === 'Escape') quickAliasForm.classList.add('hidden');
    });
  }

  if (quickAliasSubmit && quickAliasTo) {
    quickAliasSubmit.addEventListener('click', async function () {
      var to = quickAliasTo.value.trim();
      if (!to || to.indexOf('@') === -1) {
        showToast('Adresse email valide requise', 'error');
        return;
      }

      var domain = currentDomain || (data.domains && data.domains[0]) || '';
      if (!domain) {
        showToast('Aucun domaine configuré', 'error');
        return;
      }

      quickAliasSubmit.disabled = true;
      quickAliasSubmit.textContent = '…';

      try {
        var resp = await fetch('/api/aliases/ui/quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: domain, to: to }),
        });
        var result = await resp.json();

        if (result.success) {
          quickAliasForm.classList.add('hidden');
          quickAliasTo.value = '';

          var tbody = document.getElementById('alias-tbody');
          var emptyRow = document.getElementById('empty-state-row');
          if (emptyRow) emptyRow.remove();
          if (tbody) {
            tbody.insertAdjacentHTML('afterbegin', renderAliasRow(result.data));
          }
          data.aliases.unshift(result.data);

          // Re-apply filters and sort
          applyFilters();
          applySort();

          showToast('Alias ' + result.data.from + '@' + result.data.domain + ' créé', 'success');
        } else {
          showToast(result.error || 'Erreur de création', 'error');
        }
      } catch (err) {
        showToast('Erreur réseau : ' + err.message, 'error');
      } finally {
        quickAliasSubmit.disabled = false;
        quickAliasSubmit.textContent = 'OK';
      }
    });
  }

  // ===== Log init =====
  console.log('[MAM] Initialized with', data.aliases.length, 'aliases, domains:', data.domains);
})();
