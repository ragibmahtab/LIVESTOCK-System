// Base URL for the Express API. Using window.location.origin (not a
// hardcoded localhost:3000) means this keeps working whatever port/host
// actually served this page -- as long as it's served through Express
// and not opened via file://.
const API_BASE = window.location.origin;


// =================================
// Toast Notification (replaces alert() for user feedback)
// Same pattern used in every dashboard script -- kept here too so
// login/signup errors look consistent with the rest of the app.
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


// Tab Switching System
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginBtn = document.getElementById('loginTabBtn');
    const signupBtn = document.getElementById('signupTabBtn');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        loginBtn.classList.add('text-emerald-900', 'border-b-2', 'border-emerald-900');
        loginBtn.classList.remove('text-slate-400');
        signupBtn.classList.remove('text-emerald-900', 'border-b-2', 'border-emerald-900');
        signupBtn.classList.add('text-slate-400');
    } else {
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signupBtn.classList.add('text-emerald-900', 'border-b-2', 'border-emerald-900');
        signupBtn.classList.remove('text-slate-400');
        loginBtn.classList.remove('text-emerald-900', 'border-b-2', 'border-emerald-900');
        loginBtn.classList.add('text-slate-400');
    }
}

const ROLE_PAGES = {
    upazilla: 'upazilla.html',
    district: 'district.html',
    'director-store': 'director-store.html',
    'director-budget': 'director-budget.html',
    'project-director': 'project-director.html',
    'director-production': 'director-production.html',
    'director-planning': 'director-planning.html',
    'farm-manager': 'farm-manager.html'
};

// =================================
// Inline field validation (red border + "This field is required")
// Runs before both handleLogin and handleSignup, since both forms call
// e.preventDefault() immediately -- which also cancels the browser's
// own built-in validation UI, so we build our own instead.
// =================================

function setFieldError(field, message) {

    field.classList.add('border-red-500', 'focus:border-red-500');
    field.classList.remove('border-slate-300', 'focus:border-emerald-900');

    let errorEl = field.parentElement.querySelector('.field-error-message');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'field-error-message text-red-600 text-xs font-semibold mt-1.5';
        field.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = message;

    // Clear the error the moment the person starts fixing it -- only
    // bind these listeners once per field.
    if (!field.dataset.errorBound) {
        field.addEventListener('input', function () { clearFieldError(field); });
        field.addEventListener('change', function () { clearFieldError(field); });
        field.dataset.errorBound = 'true';
    }
}

function clearFieldError(field) {

    field.classList.remove('border-red-500', 'focus:border-red-500');
    field.classList.add('border-slate-300', 'focus:border-emerald-900');

    const errorEl = field.parentElement.querySelector('.field-error-message');
    if (errorEl) errorEl.remove();
}

// Validates every [required] field that's actually visible right now
// (offsetParent is null for anything inside a hidden role-fields block,
// so only the active role's fields get checked). Returns true/false and
// scrolls to + focuses the first problem field when there is one.
function validateRequiredFields(form) {

    let isValid = true;
    let firstInvalidField = null;

    form.querySelectorAll('[required]').forEach(function (field) {

        if (field.offsetParent === null) return; // hidden, skip

        const value = field.value.trim();

        if (!value) {
            setFieldError(field, 'This field is required');
            isValid = false;
            if (!firstInvalidField) firstInvalidField = field;
        } else {
            clearFieldError(field);
        }
    });

    if (firstInvalidField) {
        firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalidField.focus();
    }

    return isValid;
}


// Login Handler
async function handleLogin(e) {
    e.preventDefault();

    if (!validateRequiredFields(document.getElementById('loginForm'))) {
        return;
    }

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!data.success) {
            showToast(data.message || 'Invalid username or password.', 'error');
            return;
        }

        // Stash identity so the destination dashboard can read it.
        // Every dashboard script (upazilla_dashboard.js, director_store_dashboard.js,
        // farm_manager_dashboard.js, etc.) reads via localStorage.getItem("userId"),
        // so this has to be localStorage, not sessionStorage.
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('role', data.role);

        const targetPage = ROLE_PAGES[data.role];

        if (targetPage) {
            window.location.href = targetPage;
        } else {
            showToast('Unrecognized role returned from server.', 'error');
        }

    } catch (error) {
        console.error('Login error:', error);
        showToast('Server error during login. Please try again.', 'error');
    }
}

// Signup Request Handler
async function handleSignup(e) {
    e.preventDefault();

    const signupForm = document.getElementById('signupForm');

    if (!validateRequiredFields(signupForm)) {
        return;
    }

    const role = document.getElementById('signupRole').value;
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;

    const phoneNumbers = Array.from(document.querySelectorAll('input[name="phone_numbers[]"]'))
        .map(input => input.value.trim())
        .filter(value => value.length > 0);

    // Pull role-specific values from ONLY the currently visible block,
    // keyed by each field's "name" attribute. We deliberately avoid
    // getElementById here: several role blocks reuse the same ids
    // (e.g. gradationNumber, appointmentDate, districtId) across
    // different data-role sections, so getElementById would silently
    // grab the wrong field.
    const activeBlock = document.querySelector(`.role-fields[data-role="${role}"]`);
    const roleDetails = {};
    if (activeBlock) {
        activeBlock.querySelectorAll('input, select').forEach(field => {
            if (field.name) {
                roleDetails[field.name] = field.value.trim();
            }
        });
    }

    // validateRequiredFields already caught blank fullName/email/username/
    // password (they're all [required]) -- this only needs to check the
    // one rule that isn't a single-field check: at least ONE phone number
    // among however many rows exist.
    if (phoneNumbers.length === 0) {
        showToast('Please provide at least one phone number.', 'error');
        return;
    }

    const payload = {
        fullName,
        email,
        username,
        password,
        role,
        phoneNumbers,
        roleDetails
    };

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Registration successful! Your new User ID is ${data.userId}. You can now log in.`, 'success');
            switchTab('login');
        } else {
            showToast(data.message || 'Registration failed.', 'error');
        }

    } catch (error) {
        console.error('Registration error:', error);
        showToast('Server error during registration. Please try again.', 'error');
    }
}
