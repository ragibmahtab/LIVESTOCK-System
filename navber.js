function renderHeader(roleTitle, userName) {
    const headerHTML = `
    <header class="bg-emerald-900 text-white shadow-lg sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-6 py-3.5 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <div class="bg-white/10 p-2.5 rounded-xl border border-white/10">🏛️</div>
                <div>
                    <h1 class="text-base font-bold">Department of Livestock Services (DLS)</h1>
                    <p class="text-xs text-emerald-200">Government of the People's Republic of Bangladesh</p>
                </div>
            </div>
            <div class="flex items-center space-x-4">
                <div class="text-right">
                    <p class="text-sm font-semibold">${userName}</p>
                    <p class="text-xs text-emerald-300">${roleTitle}</p>
                </div>
                <button onclick="window.location.href='./index.html'" class="bg-red-500/20 hover:bg-red-600 text-white text-xs px-3.5 py-2 rounded-lg border border-red-400/30">
                    Logout
                </button>
            </div>
        </div>
    </header>`;
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
}
