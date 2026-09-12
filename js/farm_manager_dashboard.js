// ============================================================================
// farm_manager_dashboard.js
// Frontend logic for the Farm Manager dashboard (farm-manager.html)
// Mirrors the showView() pattern used in upazilla_dashboard.js so both
// dashboards behave the same way.
// ============================================================================

const API_BASE = 'http://localhost:3000/farm-manager';

// ----------------------------------------------------------------------------
// ASSUMPTION: same as the officer dashboard — the logged-in Farm Manager's
// User_ID (= Farm_Manager.Manager_ID) is available client-side after login.
// Wire this to whatever auth.js actually sets (localStorage / sessionStorage
// / a decoded JWT). Left as one helper so it's a one-line change.
// ----------------------------------------------------------------------------
function getManagerId() {
    return localStorage.getItem('userId');
}

function authHeaders() {
    const token = localStorage.getItem('token'); // adjust to your real auth storage
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

// ============================================================================
// VIEW SWITCHING  (same pattern as upazilla_dashboard.js)
// ============================================================================
function showView(viewId) {
    document.querySelectorAll('.dashboard-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(viewId)?.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.view === viewId) {
            link.classList.add('bg-[#064e3b]', 'text-white', 'rounded-xl', 'shadow-sm');
            link.classList.remove('text-slate-600', 'hover:bg-slate-50', 'hover:text-[#064e3b]');
        } else {
            link.classList.remove('bg-[#064e3b]', 'text-white', 'shadow-sm');
            link.classList.add('text-slate-600', 'hover:bg-slate-50', 'hover:text-[#064e3b]');
        }
    });

    switch (viewId) {
        case 'overview': loadDashboardStats(); loadRecentDemandRequests(); break;
        case 'profile-view': loadProfile(); break;
        case 'profile-edit': loadProfileForEdit(); break;
        case 'resource-check': loadFarmResources(); break;
        case 'create-demand': loadResourceDropdown('demandResourceSelect'); break;
        case 'demand-status': loadDemandStatus(); break;
        case 'record-consumption':
            if (!document.getElementById('consumptionItemsContainer').children.length) addConsumptionItemRow();
            loadConsumptionHistory();
            break;
        case 'notifications': loadNotifications(); break;
    }
}

function showToast(message, isError = false) {
    const colors = {
        success: "bg-emerald-900 border-emerald-700",
        error: "bg-red-700 border-red-600"
    };
    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation"
    };
    const type = isError ? "error" : "success";

    const toast = document.createElement("div");
    toast.className = `fixed top-6 right-6 z-50 flex items-center gap-3 text-white text-sm font-semibold px-5 py-3.5 rounded-xl shadow-lg border-l-4 ${colors[type]} transition-all duration-300 opacity-0 translate-x-4`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${message}</span>`;

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
        toast.classList.remove("opacity-0", "translate-x-4");
    });

    setTimeout(function () {
        toast.classList.add("opacity-0", "translate-x-4");
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 3000);
}

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/dashboard-stats?managerId=${getManagerId()}`, { headers: authHeaders() });
        const data = await res.json();
        // Expected shape: { MANAGER_NAME, FARM_NAME, TOTAL_RESOURCES,
        //                    LOW_STOCK_COUNT, PENDING_DEMAND_COUNT, MONTHLY_CONSUMPTION_COUNT }
        document.getElementById('statTotalResources').textContent = data.TOTAL_RESOURCES ?? '—';
        document.getElementById('statLowStock').textContent = data.LOW_STOCK_COUNT ?? '—';
        document.getElementById('statPendingDemands').textContent = data.PENDING_DEMAND_COUNT ?? '—';
        document.getElementById('statMonthlyConsumption').textContent = data.MONTHLY_CONSUMPTION_COUNT ?? '—';

        document.getElementById('headerManagerName').textContent = data.MANAGER_NAME ?? 'Farm Manager';
        document.getElementById('headerFarmName').textContent = data.FARM_NAME ? `Farm Manager — ${data.FARM_NAME}` : 'Farm Manager';
    } catch (err) {
        console.error('loadDashboardStats failed:', err);
        showToast('Could not load dashboard stats.', true);
    }
}

async function loadRecentDemandRequests() {
    const tbody = document.getElementById('recentDemandBody');
    try {
        const res = await fetch(`${API_BASE}/demand-requests?managerId=${getManagerId()}&limit=5`, { headers: authHeaders() });
        const rows = await res.json();

        if (!rows.length) {
            tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="5">No records to display yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td class="py-3.5 font-bold text-slate-800">${r.FARM_DEMAND_ID}</td>
                <td class="py-3.5">${r.RESOURCE_NAME}</td>
                <td class="py-3.5">${r.REQUESTED_QUANTITY}</td>
                <td class="py-3.5">${r.PRIORITY}</td>
                <td class="py-3.5">${statusBadge(r.STATUS)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('loadRecentDemandRequests failed:', err);
        tbody.innerHTML = `<tr><td class="py-4 text-center text-red-500" colspan="5">Failed to load.</td></tr>`;
    }
}

function statusBadge(status) {
    const map = {
        'Approved': 'bg-emerald-100 text-emerald-700',
        'Pending': 'bg-amber-100 text-amber-700',
        'Partially Approved': 'bg-orange-100 text-orange-700',
        'Rejected': 'bg-red-100 text-red-700'
    };
    const cls = map[status] || 'bg-slate-100 text-slate-600';
    return `<span class="${cls} font-bold px-2.5 py-1 rounded-full text-[10px]">${status}</span>`;
}

// ============================================================================
// VIEW PROFILE
// ============================================================================
async function loadProfile() {
    try {
        const res = await fetch(`${API_BASE}/profile?managerId=${getManagerId()}`, { headers: authHeaders() });
        const data = await res.json();
        // Expected shape: { NAME, USERNAME, EMAIL, CANDIDATE_TYPE, EXPERIENCE,
        //                    FARM_NAME, FARM_LOCATION, FARM_SCALE, PHONES: [...] }
        document.getElementById('profileName').textContent = data.NAME ?? '—';
        document.getElementById('profileCandidateType').textContent = data.CANDIDATE_TYPE ?? '—';
        document.getElementById('profileEmail').textContent = data.EMAIL ?? '—';
        document.getElementById('profilePhone').textContent = (data.PHONES && data.PHONES.length) ? data.PHONES.join(', ') : '—';
        document.getElementById('profileExperience').textContent = data.EXPERIENCE ?? '—';
        document.getElementById('profileFarm').textContent = data.FARM_NAME
            ? `${data.FARM_NAME}${data.FARM_LOCATION ? ' — ' + data.FARM_LOCATION : ''}`
            : '—';
    } catch (err) {
        console.error('loadProfile failed:', err);
        showToast('Could not load profile.', true);
    }
}

// ============================================================================
// EDIT PROFILE  (oldPhone/newPhone pairing, same as UPDATE_OFFICER_PROFILE)
// ============================================================================
async function loadProfileForEdit() {
    try {
        const res = await fetch(`${API_BASE}/profile?managerId=${getManagerId()}`, { headers: authHeaders() });
        const data = await res.json();

        document.getElementById('editName').value = data.NAME ?? '';
        document.getElementById('editEmail').value = data.EMAIL ?? '';

        const container = document.getElementById('editPhonesContainer');
        container.innerHTML = '';
        const phones = (data.PHONES && data.PHONES.length) ? data.PHONES : [''];
        phones.forEach(phone => addPhoneRow(phone));
    } catch (err) {
        console.error('loadProfileForEdit failed:', err);
        showToast('Could not load profile for editing.', true);
    }
}

function addPhoneRow(existingPhone = '') {
    const container = document.getElementById('editPhonesContainer');
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 phone-row';
    row.dataset.oldPhone = existingPhone; // '' means this is a brand-new number
    row.innerHTML = `
        <input type="text" value="${existingPhone}" placeholder="e.g. 017XXXXXXXX"
            class="phone-input flex-1 p-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:border-emerald-900 transition">
        <button type="button" class="remove-phone-btn text-red-500 hover:text-red-700 text-xs font-bold px-2">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    row.querySelector('.remove-phone-btn').addEventListener('click', () => {
        if (existingPhone) {
            // Existing phone: keep the row in the DOM (hidden) so the
            // oldPhone value still gets picked up on submit and triggers
            // the delete branch in the controller. Just clear the visible value.
            row.querySelector('.phone-input').value = '';
            row.style.display = 'none';
        } else {
            // Brand new, unsaved row: nothing to delete on the server, safe to remove
            row.remove();
        }
    });
    container.appendChild(row);
}

document.getElementById('addPhoneBtn').addEventListener('click', () => addPhoneRow());

document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const phonePairs = Array.from(document.querySelectorAll('#editPhonesContainer .phone-row')).map(row => ({
        oldPhone: row.dataset.oldPhone || null,
        newPhone: row.querySelector('.phone-input').value.trim()
    })).filter(p => p.oldPhone || p.newPhone);

    const payload = {
        managerId: getManagerId(),
        name: document.getElementById('editName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        password: document.getElementById('editPassword').value || null, // only sent if the user typed one
        phones: phonePairs
    };

    try {
        const res = await fetch(`${API_BASE}/profile`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Update failed');
        showToast('Profile updated successfully.');
        document.getElementById('editPassword').value = '';
    } catch (err) {
        console.error('Profile update failed:', err);
        showToast(err.message || 'Could not update profile.', true);
    }
});

// ============================================================================
// FARM RESOURCE CHECK
// ============================================================================
async function loadFarmResources() {
    const tbody = document.getElementById('resourceCheckBody');
    const sortDir = document.getElementById('resourceSortSelect').value;
    tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="5">Loading...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/resources?managerId=${getManagerId()}&sort=${sortDir}`, { headers: authHeaders() });
        const rows = await res.json();

        if (!rows.length) {
            tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="5">No resource records to display yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td class="py-3.5 font-bold text-slate-800">${r.RESOURCE_ID}</td>
                <td class="py-3.5">${r.NAME}</td>
                <td class="py-3.5">${r.TYPE ?? '-'}</td>
                <td class="py-3.5">${r.CURRENT_QUANTITY}</td>
                <td class="py-3.5">${r.MINIMUM_QUANTITY}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('loadFarmResources failed:', err);
        tbody.innerHTML = `<tr><td class="py-4 text-center text-red-500" colspan="5">Failed to load resources.</td></tr>`;
    }
}
document.getElementById('resourceSortSelect').addEventListener('change', loadFarmResources);

// ============================================================================
// CREATE DEMAND REQUEST
// ============================================================================
async function loadResourceDropdown(selectElementId) {
    try {
        const res = await fetch(`${API_BASE}/resources?managerId=${getManagerId()}`, { headers: authHeaders() });
        const rows = await res.json();
        const optionsHtml = '<option value="">Select a resource…</option>' +
            rows.map(r => `<option value="${r.RESOURCE_ID}" data-current-stock="${r.CURRENT_QUANTITY}">${r.NAME} (Stock: ${r.CURRENT_QUANTITY})</option>`).join('');

        const select = document.getElementById(selectElementId);
        if (select) select.innerHTML = optionsHtml;
    } catch (err) {
        console.error('loadResourceDropdown failed:', err);
        showToast('Could not load resource list.', true);
    }
}

document.getElementById('createDemandForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        managerId: getManagerId(),
        resourceId: document.getElementById('demandResourceSelect').value,
        requestedQuantity: document.getElementById('demandQuantity').value,
        estimatedCost: document.getElementById('demandCost').value,
        priority: document.getElementById('demandPriority').value,
        description: document.getElementById('demandDescription').value.trim()
    };

    if (!payload.resourceId || !payload.requestedQuantity) {
        showToast('Please select a resource and enter a quantity.', true);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/demand-requests`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Submission failed');
        showToast(`Demand request ${result.FARM_DEMAND_ID ?? ''} submitted successfully.`);
        document.getElementById('createDemandForm').reset();
    } catch (err) {
        console.error('Demand request submission failed:', err);
        showToast(err.message || 'Could not submit demand request.', true);
    }
});

// ============================================================================
// CHECK DEMAND STATUS
// ============================================================================
async function loadDemandStatus() {
    const tbody = document.getElementById('demandStatusBody');
    tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="6">Loading...</td></tr>`;
    const status = document.getElementById('demandStatusFilter').value;

    try {
        const url = `${API_BASE}/demand-requests?managerId=${getManagerId()}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
        const res = await fetch(url, { headers: authHeaders() });
        const rows = await res.json();

        if (!rows.length) {
            tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="6">No demand applications to display yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td class="py-3.5 font-bold text-slate-800">${r.FARM_DEMAND_ID}</td>
                <td class="py-3.5">${r.RESOURCE_NAME}</td>
                <td class="py-3.5">${r.REQUESTED_QUANTITY}</td>
                <td class="py-3.5">${r.ESTIMATED_COST}</td>
                <td class="py-3.5">${r.PRIORITY}</td>
                <td class="py-3.5">${statusBadge(r.STATUS)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('loadDemandStatus failed:', err);
        tbody.innerHTML = `<tr><td class="py-4 text-center text-red-500" colspan="6">Failed to load demand requests.</td></tr>`;
    }
}
document.getElementById('demandStatusFilter').addEventListener('change', loadDemandStatus);

// ============================================================================
// RECORD CONSUMPTION (multi-item, repeatable rows — same shape as
// upazilla_dashboard.js's usage item rows)
// ============================================================================
function addConsumptionItemRow() {
    const container = document.getElementById('consumptionItemsContainer');
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 consumption-item-row';
    row.innerHTML = `
        <select class="consumption-resource-select flex-1 p-3 border border-slate-300 rounded-xl bg-slate-50 font-medium text-slate-800 focus:outline-none focus:border-emerald-900 transition">
            <option value="">Select a resource…</option>
        </select>
        <input type="number" min="1" placeholder="Quantity used"
            class="consumption-qty-input w-40 p-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:border-emerald-900 transition">
        <button type="button" class="remove-consumption-item-btn text-red-500 hover:text-red-700 text-xs font-bold px-2">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    row.querySelector('.remove-consumption-item-btn').addEventListener('click', () => row.remove());
    container.appendChild(row);

    fetch(`${API_BASE}/resources?managerId=${getManagerId()}`, { headers: authHeaders() })
        .then(res => res.json())
        .then(rows => {
            const optionsHtml = '<option value="">Select a resource…</option>' +
                rows.map(r => `<option value="${r.RESOURCE_ID}">${r.NAME} (Stock: ${r.CURRENT_QUANTITY})</option>`).join('');
            row.querySelector('.consumption-resource-select').innerHTML = optionsHtml;
        })
        .catch(err => console.error('Failed to populate consumption resource select:', err));
}
document.getElementById('addConsumptionItemBtn').addEventListener('click', addConsumptionItemRow);

document.getElementById('recordConsumptionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const items = Array.from(document.querySelectorAll('#consumptionItemsContainer .consumption-item-row')).map(row => ({
        resourceId: row.querySelector('.consumption-resource-select').value,
        quantityUsed: row.querySelector('.consumption-qty-input').value
    })).filter(item => item.resourceId && item.quantityUsed);

    if (!items.length) {
        showToast('Add at least one resource with a quantity used.', true);
        return;
    }

    const payload = {
        managerId: getManagerId(),
        purpose: document.getElementById('consumptionPurpose').value.trim(),
        consumptionDate: document.getElementById('consumptionDate').value,
        items
    };

    try {
        const res = await fetch(`${API_BASE}/consumption`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Submission failed');
        showToast(`Consumption record ${result.CONSUMPTION_ID ?? ''} saved successfully.`);
        document.getElementById('recordConsumptionForm').reset();
        document.getElementById('consumptionItemsContainer').innerHTML = '';
        addConsumptionItemRow();
        loadConsumptionHistory();
    } catch (err) {
        console.error('Consumption submission failed:', err);
        showToast(err.message || 'Could not save consumption record.', true);
    }
});

// ----------------------------------------------------------------------------
// Consumption History (All / Most Used / Least Used — mirrors the officer
// dashboard's Usage History filter buttons)
// ----------------------------------------------------------------------------
let activeConsumptionFilter = 'all';

async function loadConsumptionHistory() {
    const tbody = document.getElementById('consumptionHistoryBody');
    tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="5">Loading...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/consumption-history?managerId=${getManagerId()}&filter=${activeConsumptionFilter}`, { headers: authHeaders() });
        const rows = await res.json();

        if (!rows.length) {
            tbody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="5">No consumption records to display yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td class="py-3.5 font-bold text-slate-800">${r.CONSUMPTION_ID}</td>
                <td class="py-3.5">${r.RESOURCE_NAME}</td>
                <td class="py-3.5">${r.QUANTITY_USED}</td>
                <td class="py-3.5">${r.PURPOSE ?? '-'}</td>
                <td class="py-3.5 text-slate-400">${r.RECORD_DATE ? new Date(r.RECORD_DATE).toLocaleDateString() : '-'}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('loadConsumptionHistory failed:', err);
        tbody.innerHTML = `<tr><td class="py-4 text-center text-red-500" colspan="5">Failed to load consumption history.</td></tr>`;
    }
}

function setConsumptionFilter(filter, clickedBtn) {
    activeConsumptionFilter = filter;
    document.querySelectorAll('.consumption-filter-btn').forEach(btn => {
        btn.classList.remove('bg-emerald-900', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
    });
    clickedBtn.classList.remove('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
    clickedBtn.classList.add('bg-emerald-900', 'text-white');
    loadConsumptionHistory();
}

document.getElementById('consumptionFilterAll').addEventListener('click', (e) => setConsumptionFilter('all', e.currentTarget));
document.getElementById('consumptionFilterMost').addEventListener('click', (e) => setConsumptionFilter('most', e.currentTarget));
document.getElementById('consumptionFilterLeast').addEventListener('click', (e) => setConsumptionFilter('least', e.currentTarget));

// ============================================================================
// NOTIFICATIONS (low stock)
// ============================================================================
async function loadNotifications() {
    const list = document.getElementById('notificationsList');
    try {
        const res = await fetch(`${API_BASE}/notifications?managerId=${getManagerId()}`, { headers: authHeaders() });
        const rows = await res.json();

        const badge = document.getElementById('notificationCount');
        if (rows.length) {
            badge.textContent = rows.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (!rows.length) {
            list.innerHTML = '<li class="py-4 text-slate-400 text-center">No notifications to display yet.</li>';
            return;
        }

        list.innerHTML = rows.map(r => `
            <li class="py-4 flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-triangle-exclamation text-sm"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800">${r.NAME} is running low</p>
                    <p class="text-xs text-slate-500 mt-0.5">Current stock: ${r.CURRENT_QUANTITY} &middot; Minimum required: ${r.MINIMUM_QUANTITY}</p>
                </div>
            </li>
        `).join('');
    } catch (err) {
        console.error('loadNotifications failed:', err);
        list.innerHTML = '<li class="py-4 text-red-500 text-center">Failed to load notifications.</li>';
    }
}

// ----------------------------------------------------------------------------
// Initial load — dashboard overview is the default visible view
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    loadRecentDemandRequests();
    loadNotifications(); // pre-fetch so the sidebar badge count is accurate immediately
});
