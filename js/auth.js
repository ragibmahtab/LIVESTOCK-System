// Base URL for the Express API. Using window.location.origin (not a
// hardcoded localhost:3000) means this keeps working whatever port/host
// actually served this page -- as long as it's served through Express
// and not opened via file://.
const API_BASE = window.location.origin;


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

// Login Handler
async function handleLogin(e) {
    e.preventDefault();

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
            alert(data.message || 'Invalid username or password.');
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
            alert('Unrecognized role returned from server.');
        }

    } catch (error) {
        console.error('Login error:', error);
        alert('Server error during login. Please try again.');
    }
}

// Signup Request Handler
async function handleSignup(e) {
    e.preventDefault();

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

    if (!fullName || !email || !username || !password) {
        alert('Please fill in all required fields.');
        return;
    }

    if (phoneNumbers.length === 0) {
        alert('Please provide at least one phone number.');
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
            alert(`Registration successful! Your new User ID is ${data.userId}. You can now log in.`);
            switchTab('login');
        } else {
            alert(data.message || 'Registration failed.');
        }

    } catch (error) {
        console.error('Registration error:', error);
        alert('Server error during registration. Please try again.');
    }
}
