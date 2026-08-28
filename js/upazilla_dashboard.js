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
        loadItemsIntoDropdown("usageItemSelect");
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

async function loadProfileIntoForm() {

    try {

        const response = await fetch(API_BASE + "/upazila/profile?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("editName").value = data.NAME || "";
        document.getElementById("editEmail").value = data.EMAIL || "";
        document.getElementById("editPhone").value = data.PHONE || "";

    } catch (error) {
        console.error("Failed to load profile into form:", error);
    }
}

const editProfileForm = document.getElementById("editProfileForm");

if (editProfileForm) {

    editProfileForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/upazila/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    name: document.getElementById("editName").value,
                    email: document.getElementById("editEmail").value,
                    phone: document.getElementById("editPhone").value,
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

        const response = await fetch(API_BASE + "/upazila/inventory?officerId=" + officerId);
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


// =================================
// Shared: item dropdown for Create Demand + Record Usage
// =================================

async function loadItemsIntoDropdown(selectId) {

    try {

        const response = await fetch(API_BASE + "/upazila/items?officerId=" + officerId);
        const data = await response.json();

        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select an item…</option>';

        data.forEach(function (item) {
            select.innerHTML += `<option value="${item.ITEM_ID}">${item.NAME}</option>`;
        });

    } catch (error) {
        console.error("Failed to load items:", error);
    }
}


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

        const response = await fetch(API_BASE + "/upazila/demand-requests?officerId=" + officerId);
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


// =================================
// Record Item Usage & Distribution
// =================================

const itemUsageForm = document.getElementById("itemUsageForm");

if (itemUsageForm) {

    itemUsageForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/upazila/item-usage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    itemId: document.getElementById("usageItemSelect").value,
                    quantity: document.getElementById("usageQuantity").value,
                    purpose: document.getElementById("usagePurpose").value,
                    usageDate: document.getElementById("usageDate").value
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("Usage recorded");
                itemUsageForm.reset();
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

async function loadUsageHistory() {

    try {

        const response = await fetch(API_BASE + "/upazila/item-usage?officerId=" + officerId);
        const data = await response.json();

        const tableBody = document.getElementById("usageHistoryBody");
        tableBody.innerHTML = "";

        data.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.ITEM_USAGE_ID}</td>
                    <td class="py-3.5">${row.ITEM_NAME}</td>
                    <td class="py-3.5">${row.QUANTITY}</td>
                    <td class="py-3.5">${row.PURPOSE}</td>
                    <td class="py-3.5 text-slate-400">${row.USAGE_DATE}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load usage history:", error);
    }
}


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
