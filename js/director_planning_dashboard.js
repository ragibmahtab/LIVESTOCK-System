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

    if (viewId === "overview") loadOverview();
    if (viewId === "profile-view" || viewId === "profile-edit") loadProfile();
    if (viewId === "budget-requests") loadBudgetRequests();
}


// =================================
// Header name
// =================================

async function loadHeaderName() {
    try {
        const response = await fetch(API_BASE + "/director-planning/profile?officerId=" + officerId);
        const data = await response.json();
        document.getElementById("headerOfficerName").textContent = data.NAME || "Officer";
    } catch (error) {
        console.error("Failed to load header name:", error);
        document.getElementById("headerOfficerName").textContent = "Officer";
    }
}


// =================================
// Planning Overview
// =================================

async function loadOverview() {
    try {
        const response = await fetch(API_BASE + "/director-planning/overview");
        const data = await response.json();

        document.getElementById("statAdpBudget").textContent =
            "৳ " + Number(data.adpBudget).toLocaleString("en-BD");
        document.getElementById("statOngoingProjects").textContent = data.ongoingProjects;

        loadProjects();

    } catch (error) {
        console.error("Failed to load overview:", error);
    }
}

async function loadProjects() {

    const tbody = document.getElementById("projectsTableBody");
    if (!tbody) return;

    try {
        const response = await fetch(API_BASE + "/director-planning/projects");
        const data = await response.json();

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="py-3.5 text-slate-400">No ongoing projects found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(function (row) {
            const start = row.START_DATE ? new Date(row.START_DATE).getFullYear() : "?";
            const end = row.END_DATE ? new Date(row.END_DATE).getFullYear() : "Ongoing";
            return `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.NAME}</td>
                    <td class="py-3.5">৳ ${Number(row.ALLOCATION).toLocaleString("en-BD")}</td>
                    <td class="py-3.5">${start} - ${end}</td>
                </tr>`;
        }).join("");

    } catch (error) {
        console.error("Failed to load projects:", error);
        tbody.innerHTML = '<tr><td colspan="3" class="py-3.5 text-red-500">Failed to load.</td></tr>';
    }
}


// =================================
// View / Edit Profile
// =================================

async function loadProfile() {
    try {
        const response = await fetch(API_BASE + "/director-planning/profile?officerId=" + officerId);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile not found");
        }

        if (document.getElementById("profileName")) document.getElementById("profileName").textContent = data.NAME;
        if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = data.EMAIL;
        if (document.getElementById("profilePhone")) document.getElementById("profilePhone").textContent = data.PHONE || "N/A";
        if (document.getElementById("profileDivision")) document.getElementById("profileDivision").textContent = data.PLANNING_DIVISION;
        if (document.getElementById("profileJoinDate")) document.getElementById("profileJoinDate").textContent = data.APPOINTMENT_DATE;

        if (document.getElementById("editName")) document.getElementById("editName").value = data.NAME || "";
        if (document.getElementById("editEmail")) document.getElementById("editEmail").value = data.EMAIL || "";
        if (document.getElementById("editPhone")) document.getElementById("editPhone").value = data.PHONE || "";

    } catch (error) {
        console.error("Failed to load profile:", error);
    }
}

const editProfileForm = document.getElementById("editProfileForm");

if (editProfileForm) {

    editProfileForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/director-planning/profile", {
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
                showToast("Profile updated successfully");
                document.getElementById("editPassword").value = "";
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
// View Budget Requests
// =================================
// NOTE: column names assumed here (BUDGET_REQUEST_ID, OFFICE_NAME,
// BUDGET_TYPE, REQUESTED_AMOUNT, CREATION_DATE, STATUS) match the same
// shape used by director-budget's equivalent query. Confirm these
// against VW_PENDING_BUDGET_REQUESTS's actual columns and adjust the
// field names below if they differ.
async function loadBudgetRequests() {

    const tbody = document.getElementById("budgetRequestsTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-slate-400">Loading...</td></tr>';

    try {
        const response = await fetch(API_BASE + "/director-planning/budget-requests?officerId=" + officerId);
        const data = await response.json();

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-slate-400">No budget requests waiting on you right now.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(function (row) {
            const requestDate = row.REQUEST_DATE ? new Date(row.REQUEST_DATE).toLocaleDateString("en-GB") : "";
            return `
                <tr>
                    <td class="py-3.5 font-bold text-slate-800">${row.PROJECT_NAME || ""}</td>
                    <td class="py-3.5">${row.SECTOR || ""}</td>
                    <td class="py-3.5">৳ ${Number(row.REQUESTED_AMOUNT).toLocaleString("en-BD")}</td>
                    <td class="py-3.5">${requestDate}</td>
                    <td class="py-3.5">${statusBadge(row.STATUS)}</td>
                </tr>`;
        }).join("");

    } catch (error) {
        console.error("Failed to load budget requests:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-red-500">Failed to load.</td></tr>';
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
// Create Budget Request
// =================================

const budgetRequestForm = document.getElementById("budgetRequestForm");

if (budgetRequestForm) {

    budgetRequestForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/director-planning/budget-request", {
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
                showToast("Budget request submitted: " + data.id);
                budgetRequestForm.reset();
            } else {
                showToast(data.message || "Could not submit budget request", "error");
            }

        } catch (error) {
            console.error("Failed to submit budget request:", error);
            showToast("Something went wrong while submitting", "error");
        }
    });
}


// =================================
// Initial load
// =================================

document.addEventListener("DOMContentLoaded", function () {
    showView("overview");
    loadHeaderName();
});
