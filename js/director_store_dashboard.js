const API_BASE = "http://localhost:3000";
const officerId = localStorage.getItem("userId");


// =================================
// Toast Notification (replaces alert() for user feedback)
// =================================

function showToast(message, type = "success") {

    const colors = {
        success: "bg-emerald-900 border-emerald-700",
        error: "bg-red-700 border-red-600"
    };

    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation"
    };

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

function showView(viewId) {
    document.querySelectorAll(".dashboard-view").forEach(function (el) {
        el.classList.add("hidden");
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".nav-link").forEach(function (el) {
        el.classList.remove("bg-[#064e3b]", "text-white", "shadow-sm");
        el.classList.add("text-slate-600");
    });
    const activeLink = document.querySelector('[data-view="' + viewId + '"]');
    if (activeLink) {
        activeLink.classList.add("bg-[#064e3b]", "text-white", "shadow-sm");
        activeLink.classList.remove("text-slate-600");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (viewId === "overview") loadDashboardStats();
    if (viewId === "profile-view") loadProfile();
    if (viewId === "profile-edit") loadProfileIntoForm();
    if (viewId === "demand-requests") loadDemandRequests();
    if (viewId === "create-supply") loadApprovedRequests();
}


// =================================
// Header name
// =================================

async function loadHeaderName() {
    try {
        const response = await fetch(API_BASE + "/director-store/profile?officerId=" + officerId);
        const data = await response.json();
        document.getElementById("headerOfficerName").textContent = data.NAME || "Officer";
    } catch (error) {
        console.error("Failed to load header name:", error);
        document.getElementById("headerOfficerName").textContent = "Officer";
    }
}


// =================================
// Dashboard Overview
// =================================

async function loadDashboardStats() {
    try {
        const response = await fetch(API_BASE + "/director-store/dashboard-stats?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("statTotalStocked").textContent = data.totalStockedItems;
        document.getElementById("statPendingRequests").textContent = data.pendingRequests;
        document.getElementById("statDeliveredThisMonth").textContent = data.deliveredThisMonth;
        document.getElementById("statTotalBudget").textContent = "৳ " + data.totalBudget;
        document.getElementById("statUsedBudget").textContent = "৳ " + data.usedBudget;
        document.getElementById("statRemainingBudget").textContent = "৳ " + data.remainingBudget;

    } catch (error) {
        console.error("Failed to load dashboard stats:", error);
    }
}


// =================================
// View / Edit Profile
// =================================

async function loadProfile() {
    try {
        const response = await fetch(API_BASE + "/director-store/profile?officerId=" + officerId);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile not found");
        }

        document.getElementById("profileName").textContent = data.NAME;
        document.getElementById("profileDesignation").textContent = "Director (Store & Supply)";
        document.getElementById("profileEmail").textContent = data.EMAIL;
        document.getElementById("profilePhone").textContent = data.PHONES || "Not available";
        document.getElementById("profileWorkplace").textContent = data.OFFICE_UNIT;
        document.getElementById("profileJoinDate").textContent = data.APPOINTMENT_DATE;

    } catch (error) {
        console.error("Failed to load profile:", error);
    }
}

function createPhoneRow(existingPhone) {
    const row = document.createElement("div");
    row.className = "flex gap-2 phone-row";
    row.innerHTML = `
        <input type="text" class="phone-input flex-1 p-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800"
            value="${existingPhone || ''}" data-old-phone="${existingPhone || ''}" placeholder="e.g.: 01xxxxxxxxx">
        <button type="button" class="remove-phone-btn text-red-600 px-3"><i class="fa-solid fa-trash"></i></button>
    `;
    row.querySelector(".remove-phone-btn").addEventListener("click", function () {
        const input = row.querySelector(".phone-input");
        if (input.dataset.oldPhone) {
            // Existing phone: keep the row in the DOM (hidden) so the
            // oldPhone value still gets picked up on submit and triggers
            // the delete branch in the controller. Just clear the visible value.
            input.value = "";
            row.style.display = "none";
        } else {
            // Brand new, unsaved row: nothing to delete on the server, safe to remove
            row.remove();
        }
    });
    return row;
}

async function loadProfileIntoForm() {
    try {
        const response = await fetch(API_BASE + "/director-store/profile?officerId=" + officerId);
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

document.getElementById("editProfileForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const phones = [];
    document.querySelectorAll(".phone-row").forEach(function (row) {
        const input = row.querySelector(".phone-input");
        phones.push({ oldPhone: input.dataset.oldPhone, newPhone: input.value.trim() });
    });

    try {
        const response = await fetch(API_BASE + "/director-store/profile", {
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
            showToast("Profile updated successfully");
        } else {
            showToast(data.message || "Could not update profile", "error");
        }

    } catch (error) {
        console.error("Failed to update profile:", error);
        showToast("Something went wrong while saving your profile", "error");
    }
});


// =================================
// Verify Demand Requests
// =================================

async function loadDemandRequests() {
    try {
        const response = await fetch(API_BASE + "/director-store/demand-requests?officerId=" + officerId);
        const data = await response.json();

        const tableBody = document.getElementById("demandRequestsBody");
        tableBody.innerHTML = "";

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="6">No demand requests waiting on you right now.</td></tr>`;
            return;
        }

        data.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.UPZ_NAME} (via ${row.DIST_NAME})</td>
                    <td class="py-3.5">${row.ITEM_NAME}</td>
                    <td class="py-3.5">${row.QUANTITY}</td>
                    <td class="py-3.5">${row.SUBMISSION_DATE}</td>
                    <td class="py-3.5"><span class="bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full text-[10px]">${row.STATUS}</span></td>
                    <td class="py-3.5 space-x-2">
                        <button onclick="handleApprove('${row.DEMAND_REQUEST_ID}')" class="bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-lg text-[11px] hover:bg-emerald-200 transition">Approve</button>
                        <button onclick="handleReject('${row.DEMAND_REQUEST_ID}')" class="bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-lg text-[11px] hover:bg-red-200 transition">Reject</button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load demand requests:", error);
    }
}

async function handleApprove(demandRequestId) {
    try {
        const response = await fetch(API_BASE + "/director-store/demand-requests/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ officerId: officerId, demandRequestId: demandRequestId })
        });
        const data = await response.json();
        if (data.success) {
            showToast("Request approved");
            loadDemandRequests();
        } else {
            showToast(data.message || "Could not approve request", "error");
        }
    } catch (error) {
        console.error("Failed to approve request:", error);
        showToast("Something went wrong while approving the request", "error");
    }
}

async function handleReject(demandRequestId) {
    try {
        const response = await fetch(API_BASE + "/director-store/demand-requests/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ officerId: officerId, demandRequestId: demandRequestId })
        });
        const data = await response.json();
        if (data.success) {
            showToast("Request rejected");
            loadDemandRequests();
        } else {
            showToast(data.message || "Could not reject request", "error");
        }
    } catch (error) {
        console.error("Failed to reject request:", error);
        showToast("Something went wrong while rejecting the request", "error");
    }
}


// =================================
// Create Supply
// =================================

let cachedApprovedRequests = [];

async function loadApprovedRequests() {
    try {
        const response = await fetch(API_BASE + "/director-store/approved-requests?officerId=" + officerId);
        const data = await response.json();
        cachedApprovedRequests = data;

        const select = document.getElementById("supplyDemandRequest");
        select.innerHTML = `<option value="">-- Select an approved request --</option>`;

        data.forEach(function (row) {
            select.innerHTML += `<option value="${row.DEMAND_REQUEST_ID}">${row.DEMAND_REQUEST_ID} — ${row.ITEM_NAME} for ${row.UPZ_NAME} (Qty: ${row.QUANTITY}, Est. Cost: ৳${row.ESTIMATED_COST})</option>`;
        });

    } catch (error) {
        console.error("Failed to load approved requests:", error);
    }
}

document.getElementById("supplyDemandRequest").addEventListener("change", function () {
    const selected = cachedApprovedRequests.find(r => r.DEMAND_REQUEST_ID === this.value);
    document.getElementById("supplyCost").value = selected ? selected.ESTIMATED_COST : "";
});

document.getElementById("createSupplyForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    try {
        const response = await fetch(API_BASE + "/director-store/supply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                officerId: officerId,
                demandRequestId: document.getElementById("supplyDemandRequest").value,
                grantedQuantity: document.getElementById("supplyGrantedQuantity").value,
                cost: document.getElementById("supplyCost").value,
                supplyDate: document.getElementById("supplyDate").value
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast("Supply created: " + data.supplyId);
            e.target.reset();
            loadApprovedRequests();
        } else {
            showToast(data.message || "Could not create supply", "error");
        }
    } catch (error) {
        console.error("Failed to create supply:", error);
        showToast("Something went wrong while creating the supply", "error");
    }
});


// =================================
// Create Budget Request
// =================================

document.getElementById("createBudgetRequestForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    try {
        const response = await fetch(API_BASE + "/director-store/budget-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                officerId: officerId,
                budgetType: document.getElementById("budgetType").value,
                requestedAmount: document.getElementById("requestedAmount").value
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast("Budget request submitted: " + data.budgetRequestId);
            e.target.reset();
        } else {
            showToast(data.message || "Could not submit budget request", "error");
        }
    } catch (error) {
        console.error("Failed to submit budget request:", error);
        showToast("Something went wrong while submitting the budget request", "error");
    }
});


// =================================
// Run on page load
// =================================

document.addEventListener("DOMContentLoaded", function () {
    showView("overview");
    loadHeaderName();
});