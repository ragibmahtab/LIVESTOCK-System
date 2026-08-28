// ==============================
// Tab Switching
// ==============================

function switchTab(tab) {

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    const loginBtn = document.getElementById("loginTabBtn");
    const signupBtn = document.getElementById("signupTabBtn");


    if (tab === "login") {

        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");

        loginBtn.classList.add(
            "text-emerald-900",
            "border-b-2",
            "border-emerald-900"
        );

        loginBtn.classList.remove("text-slate-400");

        signupBtn.classList.remove(
            "text-emerald-900",
            "border-b-2",
            "border-emerald-900"
        );

        signupBtn.classList.add("text-slate-400");

    } else {

        signupForm.classList.remove("hidden");
        loginForm.classList.add("hidden");

        signupBtn.classList.add(
            "text-emerald-900",
            "border-b-2",
            "border-emerald-900"
        );

        signupBtn.classList.remove("text-slate-400");

        loginBtn.classList.remove(
            "text-emerald-900",
            "border-b-2",
            "border-emerald-900"
        );

        loginBtn.classList.add("text-slate-400");
    }
}


// ==============================
// Login
// ==============================

async function handleLogin(event) {

    // Prevent the page from refreshing
    event.preventDefault();


    // Get values entered by the user
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;


    try {

        // Send login information to Node.js
        const response = await fetch("http://localhost:3000/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username: username,
                password: password,

            })
        });


        // Get response from backend
        const result = await response.json();


        // Check whether login was successful
        if (result.success) {

            localStorage.setItem("userId", result.userId);
            localStorage.setItem("role", result.role);
            redirectToRolePage(result.role);

        } else {

            alert(result.message);
        }


    } catch (error) {

        console.error("Login error:", error);

        alert("Could not connect to the server.");
    }
}


// ==============================
// Redirect According to Role
// ==============================

function redirectToRolePage(role) {

    const pageDirectory =
        window.location.pathname.toLowerCase().includes("/frontend/")
            ? "./"
            : "./Frontend/";


    const rolePages = {

        upazilla: `${pageDirectory}upazilla.html`,

        district: `${pageDirectory}district.html`,

        "director-store": `${pageDirectory}director-store.html`,

        "director-budget": `${pageDirectory}director-budget.html`,

        "project-director": `${pageDirectory}project-director.html`,

        "director-production": `${pageDirectory}director-production.html`,

        "director-planning": `${pageDirectory}director-planning.html`,

        "farm-manager": `${pageDirectory}farm-manager.html`
    };


    const targetPage = rolePages[role];


    if (targetPage) {

        window.location.href = targetPage;

    } else {

        alert("Please select a role.");
    }
}


// ==============================
// Signup
// ==============================

function handleSignup(event) {

    event.preventDefault();

    alert(
        "Your registration application has been submitted! " +
        "You will be able to log in after administrator approval."
    );

    switchTab("login");
}