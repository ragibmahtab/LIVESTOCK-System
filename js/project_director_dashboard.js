const API_BASE = "http://localhost:3000";
const officerId = localStorage.getItem("userId");

// ---- Auth guard ----
if (!officerId) {
    window.location.href = "./index.html";
}


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
    if (viewId === "project-plan") loadProjectPlan();

    if (viewId === "project-details") loadProjectDetails();
    if (viewId === "purchase-record") {
        loadPurchaseRecords();
        loadPlanItemsForPurchase();
    }
}

function handleLogout() {
    localStorage.removeItem("userId");
    window.location.href = "./index.html";
}


// =================================
// Header name
// =================================

async function loadHeaderName() {
    try {
        const response = await fetch(API_BASE + "/project-director/profile?officerId=" + officerId);
        const data = await response.json();
        document.getElementById("headerOfficerName").textContent = data.NAME || "Officer";
    } catch (error) {
        console.error("Failed to load header name:", error);
        document.getElementById("headerOfficerName").textContent = "Officer";
    }
}


// =================================
// Overview
// =================================

async function loadOverview() {
    try {
        const response = await fetch(API_BASE + "/project-director/overview?officerId=" + officerId);
        const data = await response.json();

        document.getElementById("statTotalBudget").textContent =
            "৳ " + Number(data.totalBudget).toLocaleString("en-BD");
        document.getElementById("statPendingProposals").textContent =
            String(data.pendingProposals).padStart(2, "0");

    } catch (error) {
        console.error("Failed to load overview:", error);
    }
}


// =================================
// View Profile
// =================================

async function loadProfile() {
    try {
        const response = await fetch(API_BASE + "/project-director/profile?officerId=" + officerId);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile not found");
        }

        if (document.getElementById("profileName")) document.getElementById("profileName").textContent = data.NAME;
        if (document.getElementById("profileGradation")) document.getElementById("profileGradation").textContent = data.GRADATION_NO;
        if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = data.EMAIL;
        if (document.getElementById("profilePhone")) document.getElementById("profilePhone").textContent = data.PHONE || "N/A";
        if (document.getElementById("profileProject")) document.getElementById("profileProject").textContent = data.PROJECT_NAME;

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

            const response = await fetch(API_BASE + "/project-director/profile", {
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
// Project Plan
// =================================

async function loadProjectPlan() {

    const tbody = document.getElementById("planTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-slate-400">Loading...</td></tr>';

    try {
        const response = await fetch(API_BASE + "/project-director/plan?officerId=" + officerId);
        const data = await response.json();

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-slate-400">No plan entries found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(row => `
            <tr>
                <td class="py-3.5 font-bold text-slate-800">${row.FISCAL_YEAR}</td>
                <td class="py-3.5">${row.ITEM_NAME || ""}</td>
                <td class="py-3.5">${row.TYPE || ""}</td>
                <td class="py-3.5">${row.QUANTITY}</td>
                <td class="py-3.5">৳ ${Number(row.ESTIMATED_COST).toLocaleString("en-BD")}</td>
            </tr>`).join("");

    } catch (error) {
        console.error("Failed to load plan:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-red-500">Failed to load.</td></tr>';
    }
}


// =================================
// Purchase Records
// =================================

async function loadPurchaseRecords() {

    const tbody = document.getElementById("purchaseRecordTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-slate-400">Loading...</td></tr>';

    try {
        const response = await fetch(API_BASE + "/project-director/purchase-records?officerId=" + officerId);
        const data = await response.json();

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-slate-400">No purchase records yet.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(row => `
            <tr>
                <td class="py-3.5 font-bold text-slate-800">${row.ITEM_NAME}</td>
                <td class="py-3.5">${row.FISCAL_YEAR || ""}</td>
                <td class="py-3.5">৳ ${Number(row.COST).toLocaleString("en-BD")}</td>
                <td class="py-3.5">${row.QUANTITY}</td>
                <td class="py-3.5">${row.PURCHASE_DATE ? new Date(row.PURCHASE_DATE).toLocaleDateString("en-GB") : ""}</td>
            </tr>`).join("");

    } catch (error) {
        console.error("Failed to load purchase records:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="py-3.5 text-red-500">Failed to load.</td></tr>';
    }
}

const purchaseRecordForm = document.getElementById("purchaseRecordForm");

if (purchaseRecordForm) {

    purchaseRecordForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/project-director/purchase-records", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    itemName: document.getElementById("prItemName").value,
                    fiscalYear: document.getElementById("prFiscalYear").value,
                    cost: document.getElementById("prCost").value,
                    purchaseDate: document.getElementById("prPurchaseDate").value,
                    quantity: document.getElementById("prQuantity").value
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast("Purchase record saved");
                purchaseRecordForm.reset();
                loadPurchaseRecords();
                loadOverview();
            } else {
                showToast(data.message || "Could not save purchase record", "error");
            }

        } catch (error) {
            console.error("Failed to save purchase record:", error);
            showToast("Something went wrong while saving", "error");
        }
    });
}

// =================================
// Plan Items (for the purchase record dropdown)
// =================================

async function loadPlanItemsForPurchase() {

    const select = document.getElementById("prPlanSelect");
    if (!select) return;

    try {
        const response = await fetch(API_BASE + "/project-director/plan?officerId=" + officerId);
        const data = await response.json();

        if (!data.length) {
            select.innerHTML = '<option value="" disabled selected>No plan entries found</option>';
            return;
        }

        select.innerHTML = '<option value="" disabled selected>Select from your project plan...</option>' +
            data.map((row, index) => `
                <option value="${index}">${row.ITEM_NAME || "Untitled item"} — ${row.FISCAL_YEAR}</option>
            `).join("");

        select.onchange = function () {
            const row = data[Number(select.value)];
            document.getElementById("prItemName").value = row.ITEM_NAME || "";
            document.getElementById("prFiscalYear").value = row.FISCAL_YEAR || "";
            document.getElementById("prPlanHint").textContent =
                "Planned quantity for this fiscal year: " + row.QUANTITY;
        };

    } catch (error) {
        console.error("Failed to load plan items for purchase form:", error);
        select.innerHTML = '<option value="" disabled selected>Failed to load plan items</option>';
    }
}


// =================================
// Budget Request
// =================================

const budgetRequestForm = document.getElementById("budgetRequestForm");

if (budgetRequestForm) {

    budgetRequestForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            const response = await fetch(API_BASE + "/project-director/budget-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    officerId: officerId,
                    requestedAmount: document.getElementById("brAmount").value,
                    priority: document.getElementById("brPriority").value
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast("Budget request submitted");
                budgetRequestForm.reset();
                loadOverview();
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
// Project Details
// =================================

async function loadProjectDetails() {
    try {
        const response = await fetch(API_BASE + "/project-director/project-details?officerId=" + officerId);
        const data = await response.json();

        if (data.success === false) return;

        document.getElementById("pdProjectName").textContent = data.NAME;
        document.getElementById("pdProjectId").textContent = data.PROJECT_ID;
        document.getElementById("pdType").textContent = data.TYPE || "N/A";

        const start = data.START_DATE ? new Date(data.START_DATE).toLocaleDateString("en-GB") : "?";
        const end = data.END_DATE ? new Date(data.END_DATE).toLocaleDateString("en-GB") : "Ongoing";
        document.getElementById("pdDuration").textContent = `${start} - ${end}`;

        document.getElementById("pdLocation").textContent =
            [data.VILLAGE, data.UNION_NAME, data.UPAZILA, data.DISTRICT].filter(Boolean).join(", ") || "N/A";

        // also fills the "Duration" line on the Overview budget card
        if (document.getElementById("statBudgetDuration")) {
            document.getElementById("statBudgetDuration").textContent = `Duration: ${start} - ${end}`;
        }

    } catch (error) {
        console.error("Failed to load project details:", error);
    }
}


// =================================
// Initial load
// =================================

document.addEventListener("DOMContentLoaded", function () {
    loadOverview();
    loadProjectDetails();
    loadProfile();
    loadHeaderName();
});
