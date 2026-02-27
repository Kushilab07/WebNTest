import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// YOUR EXISTING FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCWpp7vH0FAubDAW1Gvw5LMmtEqfMIq4u0",
    authDomain: "niat-admission-form.firebaseapp.com",
    projectId: "niat-admission-form",
    storageBucket: "niat-admission-form.firebasestorage.app",
    messagingSenderId: "907218345703",
    appId: "1:907218345703:web:57e6dd3d74baab2f190c42",
    measurementId: "G-YPCVGYS7L9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TOAST SYSTEM ---
window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let borderClass = type === 'success' ? 'border-l-emerald-500' : (type === 'error' ? 'border-l-red-500' : 'border-l-blue-500');
    let iconColor = type === 'success' ? 'text-emerald-500' : (type === 'error' ? 'text-red-500' : 'text-blue-500');
    
    toast.className = `flex items-center gap-3 p-4 rounded-xl shadow-xl bg-white dark:bg-slate-800 border-l-4 ${borderClass} transform transition-all duration-300 translate-x-full opacity-0`;
    toast.innerHTML = `<i data-lucide="info" class="w-5 h-5 ${iconColor}"></i><p class="text-sm font-bold">${message}</p>`;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- THE INVISIBLE GATE (AUTH LISTENER) ---
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard-screen');
    const btn = document.getElementById('loginBtn'); // Grab the button to reset it later

    if (user) {
        // VERIFICATION STEP: Check if user exists in the 'admins' Firestore collection
        try {
            const adminDocRef = doc(db, 'admins', user.email);
            const adminDoc = await getDoc(adminDocRef);

            if (adminDoc.exists()) {
                // User is verified Admin! Reveal Dashboard.
                loginScreen.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => {
                    loginScreen.classList.add('hidden');
                    dashboard.classList.remove('hidden');
                    setTimeout(() => dashboard.classList.remove('opacity-0'), 50);
                    
                    // Load Initial Data
                    window.loadTableData('Arikuchi');
                }, 300);
            } else {
                // Boot them out instantly
                await signOut(auth);
                window.showToast("Unauthorized Access. Incident Logged.", "error");
                
                // Stop the spinner
                if(btn) {
                    btn.innerHTML = `<span>Authenticate</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
                    btn.disabled = false;
                    lucide.createIcons();
                }
            }
        } catch (error) {
            console.error("Verification Error:", error);
            await signOut(auth);
            window.showToast("Database verification failed. Check Firestore Rules.", "error");
            
            // Stop the spinner
            if(btn) {
                btn.innerHTML = `<span>Authenticate</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
                btn.disabled = false;
                lucide.createIcons();
            }
        }
    } else {
        // Show Login Screen
        dashboard.classList.add('hidden', 'opacity-0');
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.classList.remove('opacity-0', 'pointer-events-none'), 50);
    }
});

// --- LOGIN ACTION ---
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('loginBtn');
    
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.showToast("Authenticating...", "info");
    } catch (error) {
        window.showToast("Invalid Credentials.", "error");
        btn.innerHTML = `<span>Authenticate</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
        lucide.createIcons();
        btn.disabled = false;
    }
});

// --- LOGOUT ACTION ---
window.handleAdminLogout = async () => {
    await signOut(auth);
    window.showToast("Securely logged out.", "success");
    setTimeout(() => window.location.reload(), 1000);
};

// --- BRANCH TOGGLE UI LOGIC ---
window.currentBranch = 'Arikuchi';
window.switchBranch = function(branch) {
    if (window.currentBranch === branch) return;
    window.currentBranch = branch;
    
    const btnAri = document.getElementById('btn-arikuchi');
    const btnBag = document.getElementById('btn-bagals');
    
    if(branch === 'Arikuchi') {
        btnAri.className = "px-4 py-1.5 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm transition-all";
        btnBag.className = "px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all";
    } else {
        btnBag.className = "px-4 py-1.5 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm transition-all";
        btnAri.className = "px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all";
    }
    
    window.loadTableData(branch);
};

// --- MOCK DATA LOADER (Will connect to GAS next) ---
window.loadTableData = function(branch) {
    const loader = document.getElementById('tableLoader');
    const tbody = document.getElementById('masterTableBody');
    
    loader.classList.remove('hidden');
    tbody.innerHTML = '';

    // Simulate API Call delay
    setTimeout(() => {
        loader.classList.add('hidden');
        
        // Injecting a Dummy Row to show the layout
        tbody.innerHTML = `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                <td class="py-4 px-4 font-mono text-xs text-slate-500">NIAT/A/26/00001</td>
                <td class="py-4 px-4 font-bold text-slate-900 dark:text-white">John Doe</td>
                <td class="py-4 px-4 text-slate-600 dark:text-slate-400">Advance Tally Prime</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-emerald-600">85%</span>
                        <button class="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-all"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
                    </div>
                </td>
                <td class="py-4 px-4"><span class="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase rounded-lg border border-amber-200">Active</span></td>
                <td class="py-4 px-4 flex gap-1">
                    <span class="w-2 h-2 rounded-full bg-slate-300" title="Marksheet Pending"></span>
                    <span class="w-2 h-2 rounded-full bg-emerald-500" title="Certificate Released"></span>
                </td>
                <td class="py-4 px-4 text-right">
                    <button onclick="alert('Open Manage Modal')" class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">Manage</button>
                </td>
            </tr>
        `;
        lucide.createIcons();
    }, 1000);
}

// Initialize Icons on initial script load
lucide.createIcons();
