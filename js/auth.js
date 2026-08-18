// Tab Switching System
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginBtn = document.getElementById('loginTabBtn');
    const signupBtn = document.getElementById('signupTabBtn');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        
        loginBtn.classList.add('text-emerald-400', 'border-b-2', 'border-emerald-400');
        loginBtn.classList.remove('text-slate-400');
        
        signupBtn.classList.remove('text-emerald-400', 'border-b-2', 'border-emerald-400');
        signupBtn.classList.add('text-slate-400');
    } else {
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');

        signupBtn.classList.add('text-emerald-400', 'border-b-2', 'border-emerald-400');
        signupBtn.classList.remove('text-slate-400');
        
        loginBtn.classList.remove('text-emerald-400', 'border-b-2', 'border-emerald-400');
        loginBtn.classList.add('text-slate-400');
    }
}

// Login Redirection Handler
function handleLogin(e) {
    e.preventDefault();
    const selectedRole = document.getElementById('userRole').value;
    
    // Redirecting to selected dashboard
    window.location.href = `./dashboards/${selectedRole}.html`;
}

// Signup Request Handler
function handleSignup(e) {
    e.preventDefault();
    alert('আপনার রেজিস্ট্রেশন আবেদনটি জমা নেওয়া হয়েছে! অ্যাডমিন অনুমোদনের পর আপনি লগইন করতে পারবেন।');
    switchTab('login');
}