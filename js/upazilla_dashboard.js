// upazilla_dashboard.js
// Controls the Upazila Officer dashboard: switching between sections,
// and loading/saving data for each section through the backend API.

const API_BASE = "http://localhost:3000";
const officerId = localStorage.getItem("userId");


// =================================
// Section switching
// =================================

function showView(viewId) {

    // Hide every section
    document.querySelectorAll(".dashboard-view").forEach(function (el) {
        el.classList.add("hidden");
    });

    // Show the one that was clicked
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove("hidden");
    }

    // Reset all sidebar links to inactive style
    document.querySelectorAll(".nav-link").forEach(function (el) {
        el.classList.remove("bg-[#064e3b]", "text-white", "shadow-sm");
        el.classList.add("text-slate-600");
    });

    // Highlight the active sidebar link
    const activeLink = document.querySelector('[data-view="' + viewId + '"]');
    if (activeLink) {
        activeLink.classList.add("bg-[#064e3b]", "text-white", "shadow-sm");
        activeLink.classList.remove("text-slate-600");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    // Load the data for that section
    if (viewId === "overview") loadDashboardStats();
    if (viewId === "profile-view") loadProfile();
    if (viewId === "profile-edit") loadProfileIntoForm();
    if (viewId === "inventory") loadInventory();
    if (viewId === "create-demand") loadItemsIntoDropdown("demandItemSelect");
    if (viewId === "demand-status") loadDemandStatus();
    if (viewId === "item-usage") {
        initUsageItemRows();
        loadUsageHistory();
    }
    if (viewId === "notifications") loadNotifications();
}


// =================================
// Dashboard Overview
// =================================

async function loadDashboardStats() {

    try {

        const response = await fetch(API_BASE + "/upazila/dashboard-stats?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("statTotalItems").textContent = data.totalItems;
        document.getElementById("statPendingDemands").textContent = data.pendingDemands;
        document.getElementById("statDistributed").textContent = data.distributed;

        const tableBody = document.getElementById("recentDemandBody");
        tableBody.innerHTML = "";

        data.recentDemands.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.DEMAND_REQUEST_ID}</td>
                    <td class="py-3.5">${row.ITEM_NAME}</td>
                    <td class="py-3.5">${row.QUANTITY}</td>
                    <td class="py-3.5">${row.STATUS}</td>
                    <td class="py-3.5 text-slate-400">${row.SUBMISSION_DATE}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load dashboard stats:", error);
    }
}


// =================================
// View Profile
// =================================

async function loadProfile() {

    try {

        const response = await fetch(API_BASE + "/upazila/profile?officerId=" + officerId);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile not found");
        }

        document.getElementById("profileName").textContent = data.NAME;
        document.getElementById("profileDesignation").textContent = "Upazila Livestock Officer";
        document.getElementById("profileEmail").textContent = data.EMAIL;
        document.getElementById("profilePhone").textContent = data.PHONES || "Not available";
        document.getElementById("profileUpazila").textContent = data.UPZ_NAME;


    } catch (error) {
        console.error("Failed to load profile:", error);
        document.getElementById("profileName").textContent = "Unable to load profile";
    }
}


// =================================
// Edit Profile
// =================================
function createPhoneRow(existingPhone) {
    const row = document.createElement("div");
    row.className = "phone-row flex gap-3 items-center";

    row.innerHTML = `
        <input type="hidden" class="phone-old-value" value="${existingPhone || ''}">
        <input type="text" placeholder="e.g.: 01712345678" value="${existingPhone || ''}"
            class="phone-input flex-1 p-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:border-emerald-900 transition">
        <button type="button" class="removePhoneBtn text-red-500 hover:text-red-700 px-2">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;

    row.querySelector(".removePhoneBtn").addEventListener("click", () => row.remove());

    return row;
}

async function loadProfileIntoForm() {

    try {

        const response = await fetch(API_BASE + "/upazila/profile?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("editName").value = data.NAME || "";
        document.getElementById("editEmail").value = data.EMAIL || "";

        const container = document.getElementById("editPhonesContainer");
        container.innerHTML = "";

        const phones = data.PHONE_LIST || [];

        if (phones.length === 0) {
            container.appendChild(createPhoneRow(null));
        } else {
            phones.forEach(function (phone) {
                container.appendChild(createPhoneRow(phone));
            });
        }

    } catch (error) {
        console.error("Failed to load profile into form:", error);
    }
}

document.getElementById("addPhoneBtn").addEventListener("click", function () {
    document.getElementById("editPhonesContainer").appendChild(createPhoneRow(null));
});

const editProfileForm = document.getElementById("editProfileForm");

if (editProfileForm) {

    editProfileForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const phoneRows = document.querySelectorAll(".phone-row");
            const phones = [];

            phoneRows.forEach(function (row) {
                const oldPhone = row.querySelector(".phone-old-value").value;
                const newPhone = row.querySelector(".phone-input").value;
                if (oldPhone || newPhone) {
                    phones.push({ oldPhone: oldPhone || null, newPhone: newPhone || null });
                }
            });

            const response = await fetch(API_BASE + "/upazila/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    name: document.getElementById("editName").value,
                    email: document.getElementById("editEmail").value,
                    phones: phones,
                    password: document.getElementById("editPassword").value
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("Profile updated successfully");
            } else {
                alert(data.message || "Could not update profile");
            }

        } catch (error) {
            console.error("Failed to update profile:", error);
            alert("Something went wrong while saving your profile");
        }
    });
}



// =================================
// Inventory Store Check
// =================================

async function loadInventory() {

    try {

        const sortSelect = document.getElementById("inventorySortSelect");
        const sortOrder = sortSelect ? sortSelect.value : "DESC";

        const response = await fetch(API_BASE + "/upazila/inventory?officerId=" + officerId + "&sortOrder=" + sortOrder);
        const data = await response.json();

        const tableBody = document.getElementById("inventoryBody");
        tableBody.innerHTML = "";

        data.forEach(function (item) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${item.ITEM_ID}</td>
                    <td class="py-3.5">${item.NAME}</td>
                    <td class="py-3.5">${item.TYPE}</td>
                    <td class="py-3.5">${item.CURRENT_STOCK}</td>
                    <td class="py-3.5">${item.MINIMUM_QUANTITY}</td>
                    
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load inventory:", error);
    }
}

document.getElementById("inventorySortSelect") &&
    document.getElementById("inventorySortSelect").addEventListener("change", loadInventory);


// =================================
// Create Demand Request
// =================================

const createDemandForm = document.getElementById("createDemandForm");

if (createDemandForm) {

    createDemandForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/upazila/demand-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    itemId: document.getElementById("demandItemSelect").value,
                    quantity: document.getElementById("demandQuantity").value,
                    estimatedCost: document.getElementById("demandCost").value,
                    submissionDate: document.getElementById("demandDate").value
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("Demand request submitted");
                createDemandForm.reset();
            } else {
                alert(data.message || "Could not submit demand request");
            }

        } catch (error) {
            console.error("Failed to submit demand request:", error);
            alert("Something went wrong while submitting the request");
        }
    });
}


// =================================
// Demand Application Status
// =================================

async function loadDemandStatus() {

    try {

        const sortSelect = document.getElementById("demandSortSelect");
        const sortOrder = sortSelect ? sortSelect.value : "DESC";

        const response = await fetch(API_BASE + "/upazila/demand-requests?officerId=" + officerId + "&sortOrder=" + sortOrder);
        const data = await response.json();

        const tableBody = document.getElementById("demandStatusBody");
        tableBody.innerHTML = "";

        data.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.DEMAND_REQUEST_ID}</td>
                    <td class="py-3.5">${row.ITEM_NAME}</td>
                    <td class="py-3.5">${row.QUANTITY}</td>
                    <td class="py-3.5">${row.ESTIMATED_COST}</td>
                    <td class="py-3.5">${row.STATUS}</td>
                    <td class="py-3.5 text-slate-400">${row.SUBMISSION_DATE}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load demand status:", error);
    }
}

document.getElementById("demandSortSelect") &&
    document.getElementById("demandSortSelect").addEventListener("change", loadDemandStatus);


// =================================
// Record Item Usage & Distribution
// =================================
let cachedItemsList = [];

async function fetchItemsList() {
    const response = await fetch(API_BASE + "/upazila/items?officerId=" + officerId);
    cachedItemsList = await response.json();
}

function createUsageItemRow() {
    const row = document.createElement("div");
    row.className = "usage-item-row flex gap-3 items-center";

    const options = cachedItemsList
        .map(item => `<option value="${item.ITEM_ID}">${item.NAME}</option>`)
        .join("");

    row.innerHTML = `
        <select class="usage-item-select flex-1 p-3 border border-slate-300 rounded-xl bg-slate-50 font-medium text-slate-800 focus:outline-none focus:border-emerald-900 transition">
            <option value="">Select an item…</option>
            ${options}
        </select>
        <input type="number" min="1" placeholder="Qty"
            class="usage-item-quantity w-32 p-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:border-emerald-900 transition">
        <button type="button" class="removeUsageItemBtn text-red-500 hover:text-red-700 px-2">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;

    row.querySelector(".removeUsageItemBtn").addEventListener("click", () => row.remove());

    return row;
}

async function initUsageItemRows() {
    await fetchItemsList();
    const container = document.getElementById("usageItemsContainer");
    container.innerHTML = "";
    container.appendChild(createUsageItemRow());
}

document.getElementById("addUsageItemBtn").addEventListener("click", function () {
    document.getElementById("usageItemsContainer").appendChild(createUsageItemRow());
});
const itemUsageForm = document.getElementById("itemUsageForm");

if (itemUsageForm) {

    itemUsageForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const rows = document.querySelectorAll(".usage-item-row");
        const items = [];

        rows.forEach(function (row) {
            const itemId = row.querySelector(".usage-item-select").value;
            const quantity = row.querySelector(".usage-item-quantity").value;
            if (itemId && quantity) {
                items.push({ itemId: itemId, quantity: quantity });
            }
        });

        if (items.length === 0) {
            alert("Please select at least one item with a quantity");
            return;
        }

        try {

            const response = await fetch(API_BASE + "/upazila/item-usage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    purpose: document.getElementById("usagePurpose").value,
                    usageDate: document.getElementById("usageDate").value,
                    items: items
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("Usage recorded");
                itemUsageForm.reset();
                initUsageItemRows();
                loadUsageHistory();
            } else {
                alert(data.message || "Could not record usage");
            }

        } catch (error) {
            console.error("Failed to record item usage:", error);
            alert("Something went wrong while recording usage");
        }
    });
}

let usageHistoryFilter = "all"; // "all" | "most" | "least"

async function loadUsageHistory() {

    try {

        let url = API_BASE + "/upazila/item-usage?officerId=" + officerId;
        if (usageHistoryFilter === "most") url += "&filter=most";
        if (usageHistoryFilter === "least") url += "&filter=least";

        const response = await fetch(url);
        const data = await response.json();

        const tableHead = document.getElementById("usageHistoryHead");
        const tableBody = document.getElementById("usageHistoryBody");
        tableBody.innerHTML = "";

        if (usageHistoryFilter === "all") {

            tableHead.innerHTML = `
                <th class="pb-3">Usage ID</th>
                <th class="pb-3">Item</th>
                <th class="pb-3">Quantity</th>
                <th class="pb-3">Purpose</th>
                <th class="pb-3">Date</th>
            `;

            data.forEach(function (row) {
                tableBody.innerHTML += `
                    <tr>
                        <td class="py-3.5 font-bold text-slate-800">${row.USAGE_ID}</td>
                        <td class="py-3.5">${row.ITEM_NAME}</td>
                        <td class="py-3.5">${row.QUANTITY}</td>
                        <td class="py-3.5">${row.PURPOSE}</td>
                        <td class="py-3.5 text-slate-400">${row.USAGE_DATE}</td>
                    </tr>
                `;
            });

        } else {

            tableHead.innerHTML = `
                <th class="pb-3">Item</th>
                <th class="pb-3">Total Quantity Used</th>
            `;

            data.forEach(function (row) {
                tableBody.innerHTML += `
                    <tr>
                        <td class="py-3.5 font-bold text-slate-800">${row.ITEM_NAME}</td>
                        <td class="py-3.5">${row.TOTAL_USED}</td>
                    </tr>
                `;
            });
        }

    } catch (error) {
        console.error("Failed to load usage history:", error);
    }
}

function setUsageFilter(filter) {
    usageHistoryFilter = filter;

    document.querySelectorAll(".usage-filter-btn").forEach(function (btn) {
        btn.classList.remove("bg-emerald-900", "text-white");
        btn.classList.add("bg-slate-100", "text-slate-600");
    });

    const activeBtn = document.getElementById(
        filter === "most" ? "usageFilterMost" :
            filter === "least" ? "usageFilterLeast" :
                "usageFilterAll"
    );
    activeBtn.classList.remove("bg-slate-100", "text-slate-600");
    activeBtn.classList.add("bg-emerald-900", "text-white");

    loadUsageHistory();
}

document.getElementById("usageFilterAll") &&
    document.getElementById("usageFilterAll").addEventListener("click", () => setUsageFilter("all"));
document.getElementById("usageFilterMost") &&
    document.getElementById("usageFilterMost").addEventListener("click", () => setUsageFilter("most"));
document.getElementById("usageFilterLeast") &&
    document.getElementById("usageFilterLeast").addEventListener("click", () => setUsageFilter("least"));


// =================================
// Notifications
// =================================

async function loadNotifications() {

    try {

        const response = await fetch(API_BASE + "/upazila/notifications?officerId=" + officerId);
        const data = await response.json();

        const list = document.getElementById("notificationsList");
        list.innerHTML = "";

        // Update the count badge
        const countBadge = document.getElementById("notificationCount");
        if (countBadge) {
            countBadge.textContent = data.length;
            countBadge.classList.toggle("hidden", data.length === 0);
        }

        if (data.length === 0) {
            list.innerHTML = '<li class="py-6 text-slate-400 text-center text-sm">No notifications to display yet.</li>';
            return;
        }

        data.forEach(function (item) {
            list.innerHTML += `
                <li class="flex items-start gap-3 py-3 px-4 mb-2 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                    <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                    <span class="font-bold text-slate-800 text-sm">${item}</span>
                </li>
            `;
        });

    } catch (error) {
        console.error("Failed to load notifications:", error);
    }
}


// =================================
// Run on page load
// =================================

document.addEventListener("DOMContentLoaded", function () {
    showView("overview");
});
