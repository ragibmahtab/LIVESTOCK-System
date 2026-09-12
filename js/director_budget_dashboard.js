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


// =================================
// Section switching
// =================================

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
    if (viewId === "profile") { loadProfile(); loadProfileIntoForm(); }
    if (viewId === "budget-requests") loadBudgetRequests();
    if (viewId === "annual-budget") loadAnnualBudget();
}

function toggleBudgetEdit() {
    document.getElementById("budget-profile-edit-form").classList.toggle("hidden");
}


// =================================
// Dashboard Overview
// =================================

async function loadDashboardStats() {

    try {

        const response = await fetch(API_BASE + "/director-budget/dashboard-stats?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("statTotalBudget").textContent = "৳ " + data.totalAnnualBudget;
        document.getElementById("statPendingRequests").textContent = data.pendingRequests;
        document.getElementById("statApprovedAmount").textContent = "৳ " + data.approvedThisMonthAmount;
        document.getElementById("statApprovedCount").textContent = "From " + data.approvedThisMonthCount + " requests";

        const tableBody = document.getElementById("recentRequestsBody");
        tableBody.innerHTML = "";

        if (!data.recentRequests || data.recentRequests.length === 0) {
            tableBody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="5">No recent budget requests.</td></tr>`;
            return;
        }

        data.recentRequests.forEach(function (row) {
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.OFFICE_NAME}</td>
                    <td class="py-3.5">${row.BUDGET_TYPE}</td>
                    <td class="py-3.5">৳ ${row.REQUESTED_AMOUNT}</td>
                    <td class="py-3.5">${row.CREATION_DATE}</td>
                    <td class="py-3.5">${statusBadge(row.STATUS)}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load dashboard stats:", error);
    }
}

function statusBadge(status) {
    const styles = {
        "Pending": "bg-amber-100 text-amber-700",
        "Approved": "bg-emerald-100 text-emerald-700",
        "Partially Approved": "bg-blue-100 text-blue-700",
        "Rejected": "bg-red-100 text-red-700"
    };
    const style = styles[status] || "bg-slate-100 text-slate-700";
    return `<span class="${style} font-bold px-2.5 py-1 rounded-full text-[10px]">${status}</span>`;
}


// =================================
// View Profile
// =================================

async function loadProfile() {

    try {

        const response = await fetch(API_BASE + "/director-budget/profile?officerId=" + officerId);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile not found");
        }

        document.getElementById("profileName").textContent = data.NAME;
        document.getElementById("profileDesignation").textContent = "Director (Budget & Finance)";
        document.getElementById("profileEmail").textContent = data.EMAIL;
        document.getElementById("profilePhone").textContent = data.PHONE || data.PHONES || "Not available";

    } catch (error) {
        console.error("Failed to load profile:", error);
    }
}


// =================================
// Edit Profile
// =================================

async function loadProfileIntoForm() {

    try {

        const response = await fetch(API_BASE + "/director-budget/profile?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("editName").value = data.NAME || "";
        document.getElementById("editEmail").value = data.EMAIL || "";

        const phoneInput = document.getElementById("editPhone");
        const existingPhone = data.PHONE || data.PHONES || "";
        phoneInput.value = existingPhone;
        phoneInput.dataset.oldPhone = existingPhone;

    } catch (error) {
        console.error("Failed to load profile into form:", error);
    }
}

const editBudgetProfileForm = document.getElementById("editBudgetProfileForm");

if (editBudgetProfileForm) {

    editBudgetProfileForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const phoneInput = document.getElementById("editPhone");

        try {

            const response = await fetch(API_BASE + "/director-budget/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    name: document.getElementById("editName").value,
                    email: document.getElementById("editEmail").value,
                    oldPhone: phoneInput.dataset.oldPhone,
                    newPhone: phoneInput.value.trim(),
                    password: document.getElementById("editPassword").value
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast("Profile updated successfully");
                loadProfile();
            } else {
                showToast(data.message || "Could not update profile", "error");
            }

        } catch (error) {
            console.error("Failed to update profile:", error);
            showToast("Something went wrong while saving your profile", "error");
        }
    });
}


// =================================
// Budget Requests
// =================================

async function loadBudgetRequests() {

    try {

        const response = await fetch(API_BASE + "/director-budget/budget-requests?officerId=" + officerId);
        const data = await response.json();

        const tableBody = document.getElementById("budgetRequestsBody");
        tableBody.innerHTML = "";

        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="6">No budget requests waiting on you right now.</td></tr>`;
            return;
        }

        data.forEach(function (row) {
            const actionsCell = row.STATUS === "Pending"
                ? `<button onclick="handleApprove('${row.BUDGET_REQUEST_ID}', ${row.REQUESTED_AMOUNT})" class="bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-lg text-[11px] hover:bg-emerald-200 transition">Approve</button>
                   <button onclick="handleReject('${row.BUDGET_REQUEST_ID}')" class="bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-lg text-[11px] hover:bg-red-200 transition">Reject</button>`
                : `<span class="text-slate-300">—</span>`;

            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.OFFICE_NAME}</td>
                    <td class="py-3.5">${row.BUDGET_TYPE}</td>
                    <td class="py-3.5">৳ ${row.REQUESTED_AMOUNT}</td>
                    <td class="py-3.5">${row.CREATION_DATE}</td>
                    <td class="py-3.5">${statusBadge(row.STATUS)}</td>
                    <td class="py-3.5 whitespace-nowrap">${actionsCell}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load budget requests:", error);
    }
}

let pendingApproval = null;

function handleApprove(budgetRequestId, requestedAmount) {

    pendingApproval = { budgetRequestId, requestedAmount };

    document.getElementById("approveModalRequested").textContent = "৳ " + requestedAmount;
    document.getElementById("approveModalAmount").value = requestedAmount;
    document.getElementById("approveModalAmount").max = requestedAmount;
    document.getElementById("approveModalOverlay").style.display = "flex";
}

function closeApproveModal() {
    document.getElementById("approveModalOverlay").style.display = "none";
    pendingApproval = null;
}

async function confirmApprove() {

    if (!pendingApproval) return;

    const approvedAmount = Number(document.getElementById("approveModalAmount").value);

    if (isNaN(approvedAmount) || approvedAmount <= 0) {
        showToast("Enter a valid approved amount", "error");
        return;
    }

    const { budgetRequestId } = pendingApproval;

    try {

        const response = await fetch(API_BASE + "/director-budget/budget-requests/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ officerId: officerId, budgetRequestId: budgetRequestId, approvedAmount: approvedAmount })
        });

        const data = await response.json();

        if (data.success) {
            showToast("Budget request approved");
            closeApproveModal();
            loadBudgetRequests();
        } else {
            showToast(data.message || "Could not approve request", "error");
        }

    } catch (error) {
        console.error("Failed to approve budget request:", error);
        showToast("Something went wrong while approving the request", "error");
    }
}

async function handleReject(budgetRequestId) {

    try {

        const response = await fetch(API_BASE + "/director-budget/budget-requests/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ officerId: officerId, budgetRequestId: budgetRequestId })
        });

        const data = await response.json();

        if (data.success) {
            showToast("Budget request rejected");
            loadBudgetRequests();
        } else {
            showToast(data.message || "Could not reject request", "error");
        }

    } catch (error) {
        console.error("Failed to reject budget request:", error);
        showToast("Something went wrong while rejecting the request", "error");
    }
}


// =================================
// Annual Budget Distribution
// =================================

async function loadAnnualBudget() {

    try {

        const response = await fetch(API_BASE + "/director-budget/annual-budget?officerId=" + officerId);
        const data = await response.json();

        const tableBody = document.getElementById("annualBudgetBody");
        tableBody.innerHTML = "";

        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td class="py-4 text-center text-slate-400" colspan="4">No annual budget data yet.</td></tr>`;
            return;
        }

        data.forEach(function (row) {
            const percent = row.ALLOCATION > 0 ? Math.round((row.SPENT / row.ALLOCATION) * 100) : 0;
            tableBody.innerHTML += `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.SECTOR}</td>
                    <td class="py-3.5">৳ ${row.ALLOCATION}</td>
                    <td class="py-3.5">৳ ${row.SPENT}</td>
                    <td class="py-3.5"><span class="bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[10px]">${percent}% Spent</span></td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Failed to load annual budget:", error);
    }
}


// =================================
// Run on page load
// =================================

document.addEventListener("DOMContentLoaded", function () {
    showView("overview");
});
