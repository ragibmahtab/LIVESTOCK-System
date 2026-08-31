// district_dashboard.js
// Controls the District Officer dashboard: switching between sections,
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
    if (viewId === "upazila-requests") loadUpazilaRequests();
    if (viewId === "upazila-requests") { loadUpazilaRequests(); loadUpazilaOptions(); }
}


// =================================
// Dashboard Overview
// =================================

async function loadDashboardStats() {

    try {

        const response = await fetch(API_BASE + "/district/dashboard-stats?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("statTotalUpazilas").textContent = data.totalUpazilas;
        document.getElementById("statPendingRequests").textContent = data.pendingRequests;
        document.getElementById("statForwardedRequests").textContent = data.forwardedRequests;

        const tableBody = document.getElementById("recentRequestsBody");
        tableBody.innerHTML = "";

        data.recentRequests.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.DEMAND_REQUEST_ID}</td>
                    <td class="py-3.5">${row.UPZ_NAME}</td>
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

        const response = await fetch(API_BASE + "/district/profile?officerId=" + officerId);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile not found");
        }

        document.getElementById("profileName").textContent = data.NAME;
        document.getElementById("profileDesignation").textContent = "District Livestock Officer";
        document.getElementById("profileEmail").textContent = data.EMAIL;
        document.getElementById("profilePhone").textContent = data.PHONES || "Not available";
        document.getElementById("profileDistrict").textContent = data.DIST_NAME;


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

        const response = await fetch(API_BASE + "/district/profile?officerId=" + officerId);
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
async function loadHeaderName() {
    try {
        const response = await fetch(API_BASE + "/district/profile?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("headerOfficerName").textContent = data.NAME || "Officer";

    } catch (error) {
        console.error("Failed to load header name:", error);
        document.getElementById("headerOfficerName").textContent = "Officer";
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

            const response = await fetch(API_BASE + "/district/profile", {
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
// View Upazila Requests
// =================================

async function loadUpazilaRequests() {

    try {

        const nameFilter = document.getElementById("upazilaNameFilter").value.trim();

        let url = API_BASE + "/district/upazila-requests?officerId=" + officerId;
        if (nameFilter) {
            url += "&nameFilter=" + encodeURIComponent(nameFilter);
        }

        const response = await fetch(url);
        const data = await response.json();

        const tableBody = document.getElementById("upazilaRequestsBody");
        tableBody.innerHTML = "";

        if (response.status === 404) {
            tableBody.innerHTML = `
                <tr>
                    <td class="py-4 text-center text-slate-400" colspan="7">
                        ${data.message || "No pending demand requests found."}
                    </td>
                </tr>
            `;
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Failed to load upazila requests");
        }

        data.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.DEMAND_REQUEST_ID}</td>
                    <td class="py-3.5">${row.UPZ_NAME}</td>
                    <td class="py-3.5">${row.ITEM_NAME}</td>
                    <td class="py-3.5">${row.QUANTITY}</td>
                    <td class="py-3.5">${row.ESTIMATED_COST}</td>
                    <td class="py-3.5">${row.STATUS}</td>
                    <td class="py-3.5 text-slate-400">${row.SUBMISSION_DATE}</td>
                    <td class="py-3.5 whitespace-nowrap">
    <div class="flex justify-center gap-1">
        <button onclick="viewStoreInventory('${row.ITEM_ID}', '${row.ITEM_NAME}')" class="bg-slate-200 text-slate-700 px-2 py-1 rounded text-[10px]">
            <i class="fa-solid fa-eye"></i> Inventory
        </button>
        <button onclick="handleForward('${row.DEMAND_REQUEST_ID}')" class="bg-emerald-800 text-white px-2 py-1 rounded text-[10px]">Forward</button>
        <button onclick="handleReject('${row.DEMAND_REQUEST_ID}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px]">Reject</button>
    </div>
</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load upazila requests:", error);
    }
}

async function loadUpazilaOptions() {

    try {

        const response = await fetch(API_BASE + "/district/upazila-options?officerId=" + officerId);
        const data = await response.json();

        const select = document.getElementById("upazilaNameFilter");
        select.innerHTML = `<option value="">All Upazilas</option>`;

        data.forEach(function (row) {
            select.innerHTML += `<option value="${row.UPZ_NAME}">${row.UPZ_NAME}</option>`;
        });

    } catch (error) {
        console.error("Failed to load upazila options:", error);
    }
}

async function searchUpazilaRequestsByName() {

    const selected = document.getElementById("upazilaNameFilter").value;

    if (!selected) {
        loadUpazilaRequests();
        return;
    }

    try {

        const response = await fetch(API_BASE + "/district/upazila-requests/search?officerId=" + officerId + "&upzName=" + encodeURIComponent(selected));
        const data = await response.json();

        const tableBody = document.getElementById("upazilaRequestsBody");
        tableBody.innerHTML = "";

        if (!response.ok || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td class="py-4 text-center text-slate-400" colspan="8">No pending requests for this upazila.</td>
                </tr>
            `;
            return;
        }

        data.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.DEMAND_REQUEST_ID}</td>
                    <td class="py-3.5">${row.UPZ_NAME}</td>
                    <td class="py-3.5">${row.ITEM_NAME}</td>
                    <td class="py-3.5">${row.QUANTITY}</td>
                    <td class="py-3.5">${row.ESTIMATED_COST}</td>
                    <td class="py-3.5">${row.STATUS}</td>
                    <td class="py-3.5 text-slate-400">${row.SUBMISSION_DATE}</td>
                    <td class="py-3.5 whitespace-nowrap">
    <div class="flex justify-center gap-1">
        <button onclick="viewStoreInventory('${row.ITEM_ID}', '${row.ITEM_NAME}')" class="bg-slate-200 text-slate-700 px-2 py-1 rounded text-[10px]">
            <i class="fa-solid fa-eye"></i> Inventory
        </button>
        <button onclick="handleForward('${row.DEMAND_REQUEST_ID}')" class="bg-emerald-800 text-white px-2 py-1 rounded text-[10px]">Forward</button>
        <button onclick="handleReject('${row.DEMAND_REQUEST_ID}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px]">Reject</button>
    </div>
</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to search upazila requests:", error);
    }
}
async function viewStoreInventory(itemId, itemName) {
    try {
        const response = await fetch(API_BASE + "/district/store-inventory?itemId=" + itemId);
        const data = await response.json();

        document.getElementById("inventoryModalTitle").textContent = itemName + " — current stock";

        const body = document.getElementById("inventoryModalBody");
        body.innerHTML = "";

        data.forEach(function (item) {
            body.innerHTML += `
                <tr>
                    <td class="py-2">${item.NAME}</td>
                    <td class="py-2">${item.CURRENT_STOCK}</td>
                    <td class="py-2 text-slate-400">${item.MINIMUM_QUANTITY}</td>
                </tr>
            `;
        });

        document.getElementById("inventoryModalOverlay").style.display = "flex";

    } catch (error) {
        console.error("Failed to load store inventory:", error);
    }
}

function closeInventoryModal() {
    document.getElementById("inventoryModalOverlay").style.display = "none";
}

// =================================
// Initial load
// =================================

showView("overview");
loadHeaderName();
