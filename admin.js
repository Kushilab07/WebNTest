import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

//my config currently
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


// REPLACE THESE WITH YOUR ACTUAL GOOGLE APPS SCRIPT WEB APP URLs
const URL_ARIKUCHI = "https://script.google.com/macros/s/AKfycbw250AUR58Vk0oOVtFhkhRP4cSJ-FCJW0P489mPLYBi5WEhvFDiYuL_lpOqTgH4DptX/exec";
const URL_BAGALS = "https://script.google.com/macros/s/AKfycby6OxZGFFKnYYD6VsWGulfkPIF64YNO_6b8dRT__cKtu3rWnaTY2nxRPFYxcbUnUQEbVg/exec";
//my url currently
const EXAM_API_URL = "https://script.google.com/macros/s/AKfycbw1snUBsoy3hH0ntEwy05xenJBAZvAMBUXwIHhCz60vUej1BR6hAFcHOb0-mRrlS2v-_Q/exec";

// --- GLOBAL STATE ---
window.adminData = [];
window.currentEditingRegNo = null;
window.currentEditingEmail = null; // Stored for notifications
window.currentBranch = 'Arikuchi';
let sortDirection = 1;

// Modal State Trackers
window.initialModalState = {};
window.currentModalState = {};
window.currentMarksAdded = false;

// Filter State Trackers
window.filters = {
    search: '',
    status: 'all',
    marksheet: 'all',
    certificate: 'all'
};

// ============================================================================
// --- ADVANCED NETWORK UTILITIES (EXPONENTIAL BACKOFF) ---
// ============================================================================
window.fetchWithRetry = async function(url, options = {}, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status === 429) throw new Error("Rate Limited");
            return response; 
        } catch (error) {
            retries++;
            if (retries >= maxRetries) {
                console.error("Max network retries reached.");
                throw error;
            }
            const waitTime = (Math.pow(2, retries) * 1000) + (Math.random() * 500);
            console.warn(`Network busy. Retrying in ${Math.round(waitTime)}ms... (Attempt ${retries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// --- THEME TOGGLE ---
window.toggleTheme = function () {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
    }
    lucide.createIcons();
};

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

const resetLoginButton = () => {
    const btn = document.getElementById('loginBtn');
    if (btn) {
        btn.innerHTML = `<span id="loginBtnText">Authenticate</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
};

// --- AUTH LOGIC ---
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard-screen');

    if (user) {
        try {
            const adminDocRef = doc(db, 'admins', user.email);
            const adminDoc = await getDoc(adminDocRef);

            if (adminDoc.exists()) {
                loginScreen.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => {
                    loginScreen.classList.add('hidden');
                    dashboard.classList.remove('hidden');
                    setTimeout(() => dashboard.classList.remove('opacity-0'), 50);
                    window.loadTableData(window.currentBranch);
                }, 300);
            } else {
                // If a student logs in here, instantly sign them out and show a clean error toast.
                await signOut(auth);
                resetLoginButton();
                window.showToast("Access Denied: Not an Admin Account.", "error");
            }
        } catch (error) {
            await signOut(auth);
            resetLoginButton();
            window.showToast("Database verification failed.", "error");
        }
    } else {
        dashboard.classList.add('hidden', 'opacity-0');
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.classList.remove('opacity-0', 'pointer-events-none'), 50);
    }
});

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('loginBtn');

    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        window.showToast("Invalid Credentials.", "error");
        resetLoginButton();
    }
});

window.handleAdminLogout = async () => {
    await signOut(auth);
    window.showToast("Securely logged out.", "success");
    setTimeout(() => window.location.reload(), 1000);
};

// --- DATA FETCHING & STATS ---
window.switchBranch = function (branch) {
    if (window.currentBranch === branch) return;
    window.currentBranch = branch;

    const btnAri = document.getElementById('btn-arikuchi');
    const btnBag = document.getElementById('btn-bagals');

    if (branch === 'Arikuchi') {
        btnAri.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm transition-all";
        btnBag.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap";
    } else {
        btnBag.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm transition-all";
        btnAri.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap";
    }

    window.setFilterStatus('all'); // Reset filter on branch switch
    if (window.filters.status === 'fee') window.loadFeeDashboard(); 
    if (window.filters.status === 'exam') window.loadExamDashboard(); // NEW: Reload exam data
    window.loadTableData(branch);
};

window.loadTableData = async function (branch) {
    const loader = document.getElementById('tableLoader');
    loader.classList.remove('hidden');

    const targetUrl = branch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;

    try {
        // UPGRADED TO EXPONENTIAL BACKOFF
        const response = await window.fetchWithRetry(`${targetUrl}?action=getAdminData`, { method: 'GET' });
        const result = await response.json();

        if (result.status === 'success') {
            window.adminData = result.data;
            updateStats(window.adminData);
            window.applyFilters(); // Renders table
            // FIX: Start the background listener for notifications immediately for the active branch!
            if (typeof startFeeRequestListener === 'function') {
                startFeeRequestListener();
            }
            // NEW: Start listening for support chats instantly
            if (typeof startSupportChatListListener === 'function') {
                startSupportChatListListener();
            }
        } else {
            window.showToast("Failed to fetch data.", "error");
        }
    } catch (error) {
        window.showToast("Network Error.", "error");
    } finally {
        loader.classList.add('hidden');
    }
};

function updateStats(data) {
    let active = 0, completed = 0, dropout = 0;
    data.forEach(s => {
        const stat = String(s[21] || '').toLowerCase();
        if (stat === 'completed') completed++;
        else if (stat === 'dropout') dropout++;
        else active++;
    });

    document.getElementById('statTotal').innerText = data.length;
    document.getElementById('statActive').innerText = active;
    document.getElementById('statCompleted').innerText = completed;
    document.getElementById('statDropout').innerText = dropout;
}

// --- FILTERING & SEARCHING ---
document.getElementById('adminSearch').addEventListener('input', (e) => {
    window.filters.search = e.target.value.toLowerCase();
    window.applyFilters();
});

window.setFilterStatus = function (status) {
    window.filters.status = status;

    // UI Update for Cards
    const cards = document.querySelectorAll('.metric-card');
    cards.forEach(c => {
        c.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        c.classList.add('border-transparent', 'bg-white', 'dark:bg-slate-800');
    });

    const targetCard = document.getElementById(`card-${status}`);
    if (targetCard) {
        targetCard.classList.remove('border-transparent', 'bg-white', 'dark:bg-slate-800');
        targetCard.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    }

    const studentsWorkspace = document.getElementById('students-workspace');
    const feesWorkspace = document.getElementById('fees-workspace');
    const supportWorkspace = document.getElementById('support-workspace');
    const examWorkspace = document.getElementById('exam-workspace'); // NEW

    // WORKSPACE TOGGLE LOGIC
    const workspaces = [studentsWorkspace, feesWorkspace, supportWorkspace, examWorkspace];

    // Hide all workspaces first to ensure a clean transition
    workspaces.forEach(ws => {
        if (ws) {
            ws.classList.add('opacity-0');
            setTimeout(() => ws.classList.add('hidden'), 300);
        }
    });

    // Reveal the target workspace after the fade-out delay
    setTimeout(() => {
        if (status === 'fee' && feesWorkspace) {
            feesWorkspace.classList.remove('hidden');
            setTimeout(() => feesWorkspace.classList.remove('opacity-0'), 50);
            window.loadFeeDashboard(); 
        } else if (status === 'support' && supportWorkspace) {
            supportWorkspace.classList.remove('hidden');
            setTimeout(() => supportWorkspace.classList.remove('opacity-0'), 50);
        } else if (status === 'exam' && examWorkspace) { // NEW EXAM LOGIC
            examWorkspace.classList.remove('hidden');
            setTimeout(() => examWorkspace.classList.remove('opacity-0'), 50);
            window.loadExamDashboard();
        } else if (status !== 'fee' && status !== 'support' && status !== 'exam' && studentsWorkspace) {
            // This covers 'all', 'active', 'completed', and 'dropout' statuses
            studentsWorkspace.classList.remove('hidden');
            setTimeout(() => studentsWorkspace.classList.remove('opacity-0'), 50);
            window.applyFilters();
        }
    }, 300);
};

window.toggleFilterMenu = function () {
    const menu = document.getElementById('filterMenu');
    menu.classList.toggle('hidden');
};

window.applyFilters = function () {
    let filtered = window.adminData;

    // 1. Search (RegNo, Name, Course)
    if (window.filters.search) {
        const q = window.filters.search;
        filtered = filtered.filter(s =>
            String(s[1]).toLowerCase().includes(q) ||
            String(s[2]).toLowerCase().includes(q) ||
            String(s[11]).toLowerCase().includes(q)
        );
    }

    // 2. Status Card (Excludes 'fee' from standard status match)
    if (window.filters.status !== 'all' && window.filters.status !== 'fee') {
        filtered = filtered.filter(s => {
            const stat = String(s[21] || 'active').toLowerCase();
            return stat === window.filters.status;
        });
    }

    // 3. Dropdown Filters
    const courseFilter = document.getElementById('filterCourse').value;
    const feeFilter = document.getElementById('filterFee').value;
    const markFilter = document.getElementById('filterMarksheet').value;
    const certFilter = document.getElementById('filterCert').value;

    if (courseFilter !== 'all') {
        filtered = filtered.filter(s => String(s[21] || 'active').toLowerCase() === courseFilter);
    }
    if (feeFilter !== 'all') {
        filtered = filtered.filter(s => String(s[28] || 'pending').toLowerCase() === feeFilter);
    }
    if (markFilter !== 'all') {
        filtered = filtered.filter(s => String(s[22] || 'pending').toLowerCase() === markFilter);
    }
    if (certFilter !== 'all') {
        filtered = filtered.filter(s => String(s[24] || 'pending').toLowerCase() === certFilter);
    }

    // Hide dropdown
    document.getElementById('filterMenu').classList.add('hidden');
    renderTable(filtered);
};

window.sortTable = function (colIndex) {
    sortDirection *= -1;
    const sorted = [...window.adminData].sort((a, b) => {
        const valA = String(a[colIndex] || '').toLowerCase();
        const valB = String(b[colIndex] || '').toLowerCase();
        if (valA < valB) return -1 * sortDirection;
        if (valA > valB) return 1 * sortDirection;
        return 0;
    });
    // Temporarily overwrite for display
    renderTable(sorted);
}

// --- TABLE RENDERING ---
function renderTable(dataArray) {
    const tbody = document.getElementById('masterTableBody');
    tbody.innerHTML = '';

    if (dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500 font-medium">No records found matching filters.</td></tr>`;
        return;
    }

    dataArray.forEach((student) => {
        const regNo = student[1];
        const safeRegNo = String(regNo).replace(/\//g, '-'); // Safe for HTML IDs
        const name = student[2];
        const course = student[11];

        // Handle Attendance (Strip % for display)
        let rawAtt = String(student[20] || '0').replace('%', '').trim();
        if (rawAtt === '') rawAtt = '0';

        const status = String(student[21] || 'active').toLowerCase();
        const feeStat = String(student[28] || 'Pending').trim();
        const marksheetStatus = String(student[22] || 'pending').toLowerCase();
        const certStatus = String(student[24] || 'pending').toLowerCase();

        let statusPill = `<span class="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase rounded-lg border border-amber-200">Active</span>`;
        let feeBadge = `<span class="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg">${feeStat}</span>`;
        if (status === 'completed') statusPill = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase rounded-lg border border-emerald-200">Completed</span>`;
        if (status === 'dropout') statusPill = `<span class="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-extrabold uppercase rounded-lg border border-red-200">Dropout</span>`;
        if (feeStat.toLowerCase() === 'cleared') feeBadge = `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg">${feeStat}</span>`;
        else if (feeStat.toLowerCase() === 'pending') feeBadge = `<span class="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg">${feeStat}</span>`;

        // Interactive Links or Dots
        const markHtml = marksheetStatus === 'approved'
            ? `<a href="${student[23] || '#'}" target="_blank" title="Marksheet Approved" class="p-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded hover:scale-110 transition-transform"><i data-lucide="file-check-2" class="w-4 h-4"></i></a>`
            : `<span class="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1.5" title="Marksheet Pending"></span>`;

        const certHtml = certStatus === 'approved'
            ? `<a href="${student[25] || '#'}" target="_blank" title="Certificate Approved" class="p-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded hover:scale-110 transition-transform"><i data-lucide="award" class="w-4 h-4"></i></a>`
            : `<span class="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1.5" title="Certificate Pending"></span>`;

        const row = `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <td class="py-4 px-4 font-mono text-xs text-slate-500">${regNo}</td>
                <td class="py-4 px-4 font-bold text-slate-900 dark:text-white">${name}</td>
                <td class="py-4 px-4 text-slate-600 dark:text-slate-400 text-xs">${course}</td>
                
                <td class="py-4 px-4" id="att-td-${safeRegNo}">
                    <div class="flex items-center gap-2 cursor-pointer w-max" onclick="window.startEditAttendance('${regNo}', '${rawAtt}')">
                        <span class="font-bold text-blue-600">${rawAtt}</span>
                        <i data-lucide="edit-2" class="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </td>

                <td class="py-4 px-4">${statusPill}</td>
                <td class="py-3 px-4">${feeBadge}</td>
                <td class="py-4 px-4 flex gap-1 items-center h-full mt-2">
                    ${markHtml}
                    ${certHtml}
                </td>
                <td class="py-4 px-4 text-right">
                    <button onclick="window.openManageModal('${regNo}')" class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">Manage</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    if (window.lucide) lucide.createIcons();
}

// --- CSV EXPORT ---
window.exportToCSV = function () {
    if (window.adminData.length === 0) {
        window.showToast("No data to export", "info");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Reg No,Student Name,Course,Attendance %,Status,Marksheet Status,Certificate Status\n";

    window.adminData.forEach(row => {
        const reg = String(row[1] || '').replace(/,/g, '');
        const name = String(row[2] || '').replace(/,/g, '');
        const course = String(row[11] || '').replace(/,/g, '');
        const att = String(row[20] || '0').replace(/%/g, '').replace(/,/g, '');
        const stat = String(row[21] || 'Active').replace(/,/g, '');
        const ms = String(row[22] || 'Pending').replace(/,/g, '');
        const cs = String(row[24] || 'Pending').replace(/,/g, '');
        csvContent += `${reg},${name},${course},${att},${stat},${ms},${cs}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NIAT_${window.currentBranch}_Students.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- INLINE ATTENDANCE EDIT ---
window.startEditAttendance = function (regNo, currentVal) {
    const safeRegNo = regNo.replace(/\//g, '-');
    const td = document.getElementById(`att-td-${safeRegNo}`);

    // Convert to input field
    td.innerHTML = `
        <div class="flex items-center gap-1 w-max">
            <input type="number" id="att-input-${safeRegNo}" value="${currentVal}" class="w-14 px-2 py-1 text-sm border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white dark:border-blue-600">
            <button onclick="window.saveAttendanceEdit('${regNo}')" class="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"><i data-lucide="check" class="w-4 h-4"></i></button>
            <button onclick="window.cancelAttendanceEdit()" class="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    `;
    lucide.createIcons();
    document.getElementById(`att-input-${safeRegNo}`).focus();
}

window.cancelAttendanceEdit = function () {
    window.applyFilters(); // Re-render table completely restores state
}

window.saveAttendanceEdit = async function (regNo) {
    const safeRegNo = regNo.replace(/\//g, '-');
    const input = document.getElementById(`att-input-${safeRegNo}`);
    let newVal = input.value.trim();
    if (newVal === '') newVal = '0'; // default empty

    const studentIndex = window.adminData.findIndex(s => s[1] === regNo);
    if (studentIndex > -1) {
        window.adminData[studentIndex][20] = newVal; // Save raw number
        window.applyFilters(); // instantly updates UI
    }

    const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;
    try {
        await fetch(targetUrl, {
            method: 'POST',
            body: new URLSearchParams({
                action: 'adminUpdateCell',
                regNo: regNo,
                colIndex: 20,
                value: newVal
            })
        });
        window.showToast("Attendance Saved!", "success");
    } catch (error) {
        window.showToast("Failed to save database.", "error");
    }
}

// --- MODAL LOGIC (Manage Student & Strict Generation) ---
window.openManageModal = function (regNo) {
    window.scrollYPosition = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollYPosition}px`;
    document.body.style.width = '100%';
    document.body.style.overflowY = 'scroll';

    const modal = document.getElementById('manageModal');
    const overlay = document.getElementById('manageModalOverlay');

    const student = window.adminData.find(s => s[1] === regNo);
    if (!student) return;

    window.currentEditingRegNo = regNo;
    window.currentEditingEmail = student[17];

    let cStatus = student[21] || 'Active';
    cStatus = cStatus.charAt(0).toUpperCase() + cStatus.slice(1).toLowerCase();
    if (!['Active', 'Completed', 'Dropout'].includes(cStatus)) cStatus = 'Active';

    // Parse existing links to recreate state perfectly upon refresh
    const markLinkVal = student[23] ? String(student[23]).trim() : "";
    const certLinkVal = student[25] ? String(student[25]).trim() : "";

    const hasMarks = markLinkVal === "MARKS_ADDED" || markLinkVal === "MOCK_URL" || markLinkVal.startsWith("http");
    const msGen = markLinkVal === "MOCK_URL" || markLinkVal.startsWith("http");
    const certGen = certLinkVal === "MOCK_URL" || certLinkVal.startsWith("http");

    window.initialModalState = {
        course: cStatus,
        marksheet: String(student[22] || 'pending').toLowerCase(),
        cert: String(student[24] || 'pending').toLowerCase(),
        msGenerated: msGen,
        certGenerated: certGen,
        markLink: markLinkVal,
        certLink: certLinkVal
    };

    window.currentModalState = { ...window.initialModalState };
    window.currentMarksAdded = hasMarks;

    document.getElementById('modalStudentName').innerText = student[2];
    document.getElementById('modalRegNo').innerText = regNo;
    document.getElementById('modalCourseStatus').value = currentModalState.course;
    let fStatus = student[28] ? String(student[28]).trim() : 'Pending';
    fStatus = fStatus.charAt(0).toUpperCase() + fStatus.slice(1).toLowerCase(); // Capitalize first letter
    if (!['Pending', 'Partial', 'Cleared'].includes(fStatus)) fStatus = 'Pending';
    document.getElementById('modalFeeStatus').value = fStatus;
    document.getElementById('marksheetCurrentStatus').innerText = currentModalState.marksheet.toUpperCase();
    document.getElementById('certCurrentStatus').innerText = currentModalState.cert.toUpperCase();

    const addMarksBtn = document.getElementById('btnAddMarks');
    if (window.currentMarksAdded) {
        addMarksBtn.innerHTML = `Marks Added <i data-lucide="check-circle" class="w-3 h-3 inline"></i>`;
        addMarksBtn.className = "px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-300 transition-colors";
    } else {
        addMarksBtn.innerHTML = "Add Marks";
        addMarksBtn.className = "px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors";
    }

    window.evaluateModalState();

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('translate-x-full');
    });
};

window.closeManageModal = function () {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflowY = '';
    window.scrollTo(0, window.scrollYPosition);

    const modal = document.getElementById('manageModal');
    const overlay = document.getElementById('manageModalOverlay');
    modal.classList.add('translate-x-full');
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);

    window.currentEditingRegNo = null;
};

// --- SMART GRADING ENGINE (COURSE MASTER INTEGRATED) ---

window.currentExamTicketId = null;

window.openMarksModal = function (regNo = null, examId = null, courseName = null, defaultExamName = "") {
    const targetRegNo = regNo || window.currentEditingRegNo;
    if (!targetRegNo) return window.showToast("Cannot identify student registration number.", "error");

    window.currentExamTicketId = examId; // Save ticket ID to close it later
    document.getElementById('inputMarksRegNo').value = targetRegNo;
    document.getElementById('inputExamName').value = defaultExamName || '';
    
    // Inject Practice Toggle if it doesn't exist
    if (!document.getElementById('isPracticeExam')) {
        const nameInput = document.getElementById('inputExamName').parentNode;
        nameInput.insertAdjacentHTML('afterend', `
            <div class="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 mb-4 flex items-center gap-2 cursor-pointer mt-3" onclick="document.getElementById('isPracticeExam').click()">
                <input type="checkbox" id="isPracticeExam" class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500">
                <label class="text-xs font-bold text-amber-800 dark:text-amber-400 cursor-pointer">Practice / Mock Exam (Will not print on Final Marksheet)</label>
            </div>
        `);
    } else {
        document.getElementById('isPracticeExam').checked = false; // Reset
    }

    const container = document.getElementById('subjectRowsContainer');
    container.innerHTML = ''; 

    // === NEW: RESTORE EXISTING EXAM MARKS AUTOMATICALLY ===
    let existingExam = null;
    const student = window.adminData.find(s => s[1] === targetRegNo);
    if (student && student[23] && student[23].startsWith('{')) {
        try {
            const parsed = JSON.parse(student[23]);
            // Find existing exam using ID or name match (Works for Partial AND Completed!)
            existingExam = parsed.results.find(r => r.examId === examId || r.exam === defaultExamName);
        } catch(e) {}
    }

    if (existingExam && existingExam.subjects) {
        // We found a saved exam! Repopulate all boxes with their previous marks!
        document.getElementById('inputExamName').value = existingExam.exam;
        if (existingExam.type === 'practice' && document.getElementById('isPracticeExam')) {
            document.getElementById('isPracticeExam').checked = true;
        }
        existingExam.subjects.forEach(sub => window.addSubjectRow(sub.name, sub.max, sub.th, sub.pr));
    } else {
        // New Exam: Auto-populate from Course Master
        let subjectsLoaded = false;
        if (courseName && window.courseMaster[courseName]) {
            const courseSubjects = window.courseMaster[courseName];
            if (courseSubjects.length > 0) {
                courseSubjects.forEach(sub => window.addSubjectRow(sub));
                subjectsLoaded = true;
            }
        }
        if (!subjectsLoaded) {
            window.addSubjectRow();
            window.addSubjectRow();
            window.addSubjectRow();
        }
    }
    
    document.getElementById('marksEntryModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
};

window.closeMarksModal = function () {
    document.getElementById('marksEntryModal').classList.add('hidden');
};

window.addSubjectRow = function (prefilledName = "", maxVal = 100, thVal = "", prVal = "") {
    const container = document.getElementById('subjectRowsContainer');
    const rowId = `sub-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Safely parse empty/undefined values so we don't accidentally print "undefined" in the UI
    const safeTh = (thVal === undefined || thVal === null) ? "" : thVal;
    const safePr = (prVal === undefined || prVal === null) ? "" : prVal;
    
    const rowHtml = `
        <div id="${rowId}" class="subject-entry-row grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-indigo-300">
            <div class="col-span-5">
                <input type="text" class="sub-name w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-indigo-500 text-xs dark:text-white font-medium" placeholder="e.g. Tally & GST" value="${prefilledName}">
            </div>
            <div class="col-span-2">
                <input type="number" class="sub-max w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-indigo-500 text-xs dark:text-white font-bold text-center" value="${maxVal}">
            </div>
            <div class="col-span-2">
                <input type="number" class="sub-th w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-indigo-500 text-xs dark:text-white font-bold text-center" placeholder="Th" value="${safeTh}">
            </div>
            <div class="col-span-2">
                <input type="number" class="sub-pr w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-indigo-500 text-xs dark:text-white font-bold text-center" placeholder="Pr" value="${safePr}">
            </div>
            <div class="col-span-1 flex justify-center">
                <button onclick="document.getElementById('${rowId}').remove()" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
    if (window.lucide) lucide.createIcons();
};

window.saveExamMarks = async function () {
    const regNo = document.getElementById('inputMarksRegNo').value;
    const examName = document.getElementById('inputExamName').value.trim();
    const isPractice = document.getElementById('isPracticeExam').checked;
    
    if (!examName) return window.showToast("Please enter an Exam Name.", "error");

    const rowElements = document.querySelectorAll('.subject-entry-row');
    if (rowElements.length === 0) return window.showToast("Please add at least one subject.", "error");

    let subjectsArray = [];
    let grandMax = 0, grandTotal = 0, totalTh = 0, totalPr = 0;
    let hasError = false;
    let isPartiallyGraded = false; // The tracker!

    rowElements.forEach(row => {
        const name = row.querySelector('.sub-name').value.trim();
        const max = parseInt(row.querySelector('.sub-max').value) || 100;
        const thVal = row.querySelector('.sub-th').value;
        const prVal = row.querySelector('.sub-pr').value;

        if (!name && thVal === '' && prVal === '') return; // Skip empty rows
        if (!name) hasError = true;

        // Check if any specific mark box is left blank
        if (thVal === '' || prVal === '') isPartiallyGraded = true;

        const th = parseInt(thVal) || 0;
        const pr = parseInt(prVal) || 0;
        const subTotal = th + pr;

        subjectsArray.push({ name: name, max: max, th: thVal, pr: prVal, tot: subTotal });
        grandMax += max;
        grandTotal += subTotal;
        totalTh += th;
        totalPr += pr;
    });

    if (hasError) return window.showToast("Subject names cannot be blank.", "error");
    if (subjectsArray.length === 0) return window.showToast("No marks entered.", "error");

    const percentage = ((grandTotal / grandMax) * 100).toFixed(2);
    let grade = "F";
    if (percentage >= 80) grade = "A++";
    else if (percentage >= 60) grade = "A+";
    else if (percentage >= 45) grade = "B";

    const ticketStatus = isPartiallyGraded ? "Partial" : "Completed";

    const student = window.adminData.find(s => s[1] === regNo);
    if (!student) return window.showToast("Student not found.", "error");

    const btn = document.getElementById('btnSaveMarksModal');
    const ogText = btn.innerHTML;
    btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...`;
    btn.disabled = true;

    try {
        let marksData = { results: [], marksheetPdf: "" };
        const existingMarkLink = student[23]; 
        
        if (existingMarkLink) {
            if (existingMarkLink.startsWith('{')) {
                try { marksData = JSON.parse(existingMarkLink); } catch (e) { }
            } else if (existingMarkLink.startsWith('http') || existingMarkLink === 'MOCK_URL') {
                marksData.marksheetPdf = existingMarkLink;
            }
        }

        // === FIX: OVERWRITE DUPLICATES INSTEAD OF PUSHING ===
        const newResultData = {
            examId: window.currentExamTicketId || "N/A", // Save ID to link it!
            exam: examName,
            type: isPractice ? "practice" : "official",
            status: ticketStatus, 
            date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            subjects: subjectsArray,
            grandMax: grandMax,
            grandTotal: grandTotal,
            totalTh: totalTh,
            totalPr: totalPr,
            percentage: percentage,
            grade: grade
        };

        // Look for an existing exam we are resuming or editing
        let existingIndex = -1;
        if (window.currentExamTicketId && window.currentExamTicketId !== "undefined" && window.currentExamTicketId !== "null") {
            existingIndex = marksData.results.findIndex(r => r.examId === window.currentExamTicketId);
        }
        if (existingIndex === -1) {
            // Fallback check by name (Overwrites whether Partial or Completed)
            existingIndex = marksData.results.findIndex(r => r.exam === examName);
        }

        if (existingIndex > -1) {
            marksData.results[existingIndex] = newResultData; // UPDATE EXISTING
        } else {
            marksData.results.push(newResultData); // ADD NEW
        }

        const newMarkLinkString = JSON.stringify(marksData);
        const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;
        
        // 1. Push Marks to Student DB
        await window.fetchWithRetry(targetUrl, {
            method: 'POST',
            body: new URLSearchParams({
                action: 'adminUpdateCell', regNo: regNo, colIndex: 23, value: newMarkLinkString
            })
        });

        // 2. Resolve the Ticket in the Exam DB (URL-encoded to guarantee delivery)
        if (window.currentExamTicketId && window.currentExamTicketId !== "undefined" && window.currentExamTicketId !== "null") {
            try {
                await window.fetchWithRetry(EXAM_API_URL, {
                    method: 'POST',
                    body: new URLSearchParams({
                        action: 'updateStatus',
                        examId: window.currentExamTicketId,
                        status: ticketStatus
                    })
                });
                
                // Small delay so Google Sheets flush completes before the UI refreshes
                await new Promise(r => setTimeout(r, 1000)); 
            } catch(e) { console.error("Ticket update failed:", e); }
        }

        student[23] = newMarkLinkString;
        window.loadExamDashboard(); // Refresh grid to trigger UI shift
        window.showToast(isPartiallyGraded ? "Marks saved partially. Ticket remains open." : "Exam Fully Graded! Ticket Closed.", "success");
        window.closeMarksModal();

    } catch (err) {
        window.showToast("Failed to save marks.", "error");
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
};

window.generateDocument = function (docType) {
    window.showToast(`Queuing ${docType} for generation...`, "info");
    setTimeout(() => {
        if (docType === 'marksheet') {
            window.currentModalState.msGenerated = true;
            window.currentModalState.triggerMS = true; // Use a trigger flag, don't overwrite markLink!
            window.showToast("Marksheet queued! Click Save Changes to generate.", "success");
        } else {
            window.currentModalState.certGenerated = true;
            window.currentModalState.triggerCert = true; // Use a trigger flag, don't overwrite certLink!
            window.showToast("Certificate queued! Click Save Changes to generate.", "success");
        }
        window.evaluateModalState();
    }, 500);
}

window.toggleDocumentStatus = function (docType) {
    if (docType === 'marksheet') {
        window.currentModalState.marksheet = window.currentModalState.marksheet === 'approved' ? 'pending' : 'approved';
        document.getElementById('marksheetCurrentStatus').innerText = window.currentModalState.marksheet.toUpperCase();
    } else {
        window.currentModalState.cert = window.currentModalState.cert === 'approved' ? 'pending' : 'approved';
        document.getElementById('certCurrentStatus').innerText = window.currentModalState.cert.toUpperCase();
    }
    window.evaluateModalState();
};

window.evaluateModalState = function () {
    const courseStatus = document.getElementById('modalCourseStatus').value;
    window.currentModalState.course = courseStatus;

    const cardMS = document.getElementById('marksheetCard');
    const btnGenMS = document.getElementById('btnGenerateMarksheet');
    const btnTogMS = document.getElementById('btnMarksheetToggle');

    const cardCert = document.getElementById('certCard');
    const btnGenCert = document.getElementById('btnGenerateCert');
    const btnTogCert = document.getElementById('btnCertToggle');
    const btnSave = document.getElementById('btnSaveEdits');

    const isCompleted = (courseStatus === 'Completed');

    if (isCompleted && window.currentMarksAdded) {
        cardMS.classList.remove('opacity-50');
        if (window.currentModalState.msGenerated) {
            btnGenMS.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3"></i> Marksheet Generated`;
            btnGenMS.className = "w-full py-2 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-300 flex justify-center items-center gap-2 cursor-default";
            btnGenMS.disabled = true;
            btnTogMS.disabled = false;
        } else {
            btnGenMS.innerHTML = `<i data-lucide="file-cog" class="w-3 h-3"></i> Generate Marksheet`;
            btnGenMS.className = "w-full py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold rounded-lg border border-purple-200 dark:border-purple-800 flex justify-center items-center gap-2 hover:bg-purple-200 transition-colors";
            btnGenMS.disabled = false;
            btnTogMS.disabled = true;
            window.currentModalState.marksheet = 'pending';
        }
    } else {
        cardMS.classList.add('opacity-50');
        btnGenMS.disabled = true;
        btnTogMS.disabled = true;
        window.currentModalState.marksheet = 'pending';
    }

    if (isCompleted && window.currentModalState.msGenerated) {
        cardCert.classList.remove('opacity-50');
        if (window.currentModalState.certGenerated) {
            btnGenCert.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3"></i> Certificate Generated`;
            btnGenCert.className = "w-full py-2 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-300 flex justify-center items-center gap-2 cursor-default";
            btnGenCert.disabled = true;
            btnTogCert.disabled = false;
        } else {
            btnGenCert.innerHTML = `<i data-lucide="award" class="w-3 h-3"></i> Generate Certificate`;
            btnGenCert.className = "w-full py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800 flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors";
            btnGenCert.disabled = false;
            btnTogCert.disabled = true;
            window.currentModalState.cert = 'pending';
        }
    } else {
        cardCert.classList.add('opacity-50');
        btnGenCert.disabled = true;
        btnTogCert.disabled = true;
        window.currentModalState.cert = 'pending';
    }

    updateToggleButton(btnTogMS, window.currentModalState.marksheet);
    updateToggleButton(btnTogCert, window.currentModalState.cert);
    document.getElementById('marksheetCurrentStatus').innerText = window.currentModalState.marksheet.toUpperCase();
    document.getElementById('certCurrentStatus').innerText = window.currentModalState.cert.toUpperCase();

    const hasChanged =
        window.initialModalState.course !== window.currentModalState.course ||
        window.initialModalState.marksheet !== window.currentModalState.marksheet ||
        window.initialModalState.cert !== window.currentModalState.cert ||
        window.initialModalState.markLink !== window.currentModalState.markLink ||
        window.initialModalState.certLink !== window.currentModalState.certLink;

    if (hasChanged) {
        btnSave.disabled = false;
        btnSave.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnSave.disabled = true;
        btnSave.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (window.lucide) lucide.createIcons();
}

function updateToggleButton(btn, status) {
    if (status === 'approved') {
        btn.className = "px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-colors bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200";
        btn.innerText = "Revert to Pending";
    } else {
        const extraClasses = btn.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50";
        btn.className = `px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-colors bg-white border border-slate-300 text-slate-700 ${extraClasses}`;
        btn.innerText = "Set Approved";
    }
}

window.toggleCustomNotif = function () {
    const box = document.getElementById('customNotifBox');
    if (document.getElementById('notifTemplate').value === 'custom') {
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
}

window.sendNotification = async function () {
    const template = document.getElementById('notifTemplate').value;
    const customTxt = document.getElementById('customNotifBox').value;
    const msg = template === 'custom' ? customTxt : template;

    if (!msg.trim()) return window.showToast("Message cannot be empty.", "error");
    if (!window.currentEditingEmail) return window.showToast("Student email not found.", "error");

    const btn = document.getElementById('btnSendNotif');
    const ogText = btn.innerHTML;
    btn.innerHTML = `<div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sending...`;
    btn.disabled = true;

    try {
        await addDoc(collection(db, "notifications"), {
            email: window.currentEditingEmail.toLowerCase().trim(),
            message: msg,
            read: false,
            timestamp: serverTimestamp()
        });
        window.showToast("Notification sent to student portal!", "success");
        document.getElementById('customNotifBox').value = '';
    } catch (e) {
        window.showToast("Failed to send notification.", "error");
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
}

// --- SAVE EDITS BUTTON ---
window.saveStudentEdits = async function () {
    const btn = document.getElementById('btnSaveEdits');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...`;
    btn.disabled = true;

    const student = window.adminData.find(s => s[1] === window.currentEditingRegNo);

    // NEW: Get the newly selected fee status from the modal
    const newFeeStatus = document.getElementById('modalFeeStatus').value;

    student[21] = window.currentModalState.course;
    student[22] = window.currentModalState.marksheet;
    student[24] = window.currentModalState.cert;
    student[23] = window.currentModalState.markLink;
    student[25] = window.currentModalState.certLink;
    student[28] = newFeeStatus; // NEW: Update local data array (Index 28)

    const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;

    try {
        // UPGRADED TO EXPONENTIAL BACKOFF
        await window.fetchWithRetry(targetUrl, {
            method: 'POST',
            body: new URLSearchParams({
                action: 'adminSaveStudent',
                regNo: student[1],
                courseStatus: student[21],
                markStatus: student[22],
                certStatus: student[24],
                markLink: student[23], // This safely holds the JSON marks!
                certLink: student[25],
                feeStatus: student[28],
                generateMS: window.currentModalState.triggerMS ? "true" : "false",
                generateCert: window.currentModalState.triggerCert ? "true" : "false"
            })
        });

        window.showToast("Student profile updated!", "success");
        updateStats(window.adminData);
        window.applyFilters();
        window.closeManageModal();
    } catch (error) {
        window.showToast("Failed to save changes.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
};

// --- MASTER NOTIFICATION BELL MANAGER ---
window.pendingFeeCount = 0;
window.pendingSupportCount = 0;

window.updateAdminBell = function() {
    const bellDot = document.getElementById('adminNotificationDot');
    const divider = document.getElementById('support-notif-divider');
    const emptyMsg = document.getElementById('empty-notif-msg');
    
    // Manage Divider
    if (window.pendingFeeCount > 0 && window.pendingSupportCount > 0) {
        if(divider) divider.classList.remove('hidden');
    } else {
        if(divider) divider.classList.add('hidden');
    }

    // Manage Empty Message & Red Dot
    if (window.pendingFeeCount === 0 && window.pendingSupportCount === 0) {
        if(emptyMsg) emptyMsg.classList.remove('hidden');
        if(bellDot) bellDot.classList.add('hidden');
    } else {
        if(emptyMsg) emptyMsg.classList.add('hidden');
        if(bellDot) bellDot.classList.remove('hidden');
    }
};

// ============================================================================
// --- FEE DASHBOARD ENGINE ---
// ============================================================================

window.globalCoursePrices = {};
window.feeUnsubscribe = null;

// 1. Sub-Tab Switcher
window.switchFeeTab = function (tabName) {
    const btnReq = document.getElementById('fee-tab-requests');
    const btnPri = document.getElementById('fee-tab-pricing');
    const panelReq = document.getElementById('fee-panel-requests');
    const panelPri = document.getElementById('fee-panel-pricing');

    if (tabName === 'requests') {
        btnReq.className = "px-5 py-2 text-sm font-bold rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm transition-all";
        btnPri.className = "px-5 py-2 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all";
        panelPri.classList.add('hidden');
        panelReq.classList.remove('hidden');
    } else {
        btnPri.className = "px-5 py-2 text-sm font-bold rounded-lg bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm transition-all";
        btnReq.className = "px-5 py-2 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all";
        panelReq.classList.add('hidden');
        panelPri.classList.remove('hidden');
    }
};

// 2. Main Bootstrapper
window.loadFeeDashboard = async function () {
    window.showToast("Loading Financial Data...", "info");
    await fetchCoursePrices();
    renderCoursePricingGrid();
};

// 3. Pricing Manager (Fetches prices specific to current Branch)
async function fetchCoursePrices() {
    try {
        const docRef = doc(db, "admin_settings", `prices_${window.currentBranch}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            window.globalCoursePrices = docSnap.data();
        } else {
            window.globalCoursePrices = {};
        }
    } catch (e) {
        console.error("Error fetching prices:", e);
    }
}

function renderCoursePricingGrid() {
    const grid = document.getElementById('coursePricingGrid');
    grid.innerHTML = '';

    // Extract unique courses dynamically from current branch's students
    const uniqueCourses = [...new Set(window.adminData.map(s => s[11]).filter(c => c && c !== "None"))];

    if (uniqueCourses.length === 0) {
        grid.innerHTML = `<p class="text-slate-500 text-sm col-span-full p-4">No courses detected in this branch yet.</p>`;
        return;
    }

    uniqueCourses.forEach((courseName, index) => {
        const currentPrice = window.globalCoursePrices[courseName] || "";
        const safeId = `price-input-${index}`;

        grid.innerHTML += `
            <div class="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-3">
                <h4 class="font-bold text-slate-800 dark:text-white text-sm truncate" title="${courseName}">${courseName}</h4>
                <div class="flex gap-2">
                    <div class="relative w-full">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                        <input type="number" id="${safeId}" value="${currentPrice}" placeholder="0" class="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm font-bold">
                    </div>
                    <button onclick="window.saveCoursePrice('${courseName}', '${safeId}')" class="px-4 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg font-bold text-sm transition-colors shadow-sm">Save</button>
                </div>
            </div>
        `;
    });
    if (window.lucide) lucide.createIcons();
}

window.saveCoursePrice = async function (courseName, inputId) {
    const val = document.getElementById(inputId).value;
    const num = parseFloat(val);

    if (isNaN(num) || num < 0) return window.showToast("Enter a valid amount.", "error");

    try {
        window.globalCoursePrices[courseName] = num;
        const docRef = doc(db, "admin_settings", `prices_${window.currentBranch}`);

        // Use setDoc with merge: true to update or create if doesn't exist
        await setDoc(docRef, { [courseName]: num }, { merge: true });
        window.showToast(`${courseName} price updated to ₹${num}`, "success");
    } catch (e) {
        window.showToast("Failed to save price.", "error");
        console.error(e);
    }
};

// 4. Live Verification Requests Engine & Notification Bell
window.toggleAdminNotification = function() {
    const wrapper = document.getElementById('admin-notification-wrapper');
    const backdrop = document.getElementById('admin-notif-backdrop');
    const panel = document.getElementById('admin-notification-popup');

    if (wrapper.classList.contains('hidden')) {
        // OPEN OVERLAY
        document.body.style.overflow = 'hidden'; // Make main page scrollbar invisible
        wrapper.classList.remove('hidden');
        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            panel.classList.remove('translate-x-full');
        });
    } else {
        // CLOSE OVERLAY
        document.body.style.overflow = ''; // Restore main scrollbar
        backdrop.classList.add('opacity-0');
        panel.classList.add('translate-x-full');
        setTimeout(() => {
            wrapper.classList.add('hidden');
        }, 300); // Wait for sliding animation to finish
    }
};

// Close popup on outside click
// document.addEventListener('click', function (e) {
//     const popup = document.getElementById('admin-notification-popup');
//     const bell = document.querySelector('button[onclick="window.toggleAdminNotification()"]');
//     if (popup && !popup.classList.contains('hidden') && !popup.contains(e.target) && (!bell || !bell.contains(e.target))) {
//         popup.classList.add('hidden');
//     }
// });

function startFeeRequestListener() {
    if (window.feeUnsubscribe) window.feeUnsubscribe();

    const q = query(collection(db, "fee_requests"), where("branch", "==", window.currentBranch));

    window.feeUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('feeRequestsTableBody');
        const notifList = document.getElementById('admin-notif-list');
        tbody.innerHTML = '';
        notifList.innerHTML = '';

        let pendingCount = 0;
        let requestsArray = [];

        snapshot.forEach((docSnap) => {
            requestsArray.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort manually by timestamp (newest first)
        requestsArray.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        requestsArray.forEach((req) => {
            // FIX 3: Detailed Time Formatting
            const dateStr = req.timestamp ? new Date(req.timestamp.toMillis()).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "Just now";

            if (req.status === 'Pending') {
                pendingCount++;

                // Add to Bell Notifications
                notifList.innerHTML += `
                    <li onclick="window.setFilterStatus('fee'); window.switchFeeTab('requests'); window.toggleAdminNotification();" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-all relative">
                        <span class="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span class="font-bold block text-blue-600 text-xs mb-1">New Verification</span>
                        <p class="text-xs text-slate-700 dark:text-slate-300"><b>${req.studentName}</b> sent ₹${req.amount} for ${req.courseName}.</p>
                    </li>
                `;

                // Add to Main Live Table
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 group border-b border-slate-100 dark:border-slate-800/50">
                        <td class="py-4 px-4 text-xs font-bold text-slate-500">${dateStr}</td>
                        <td class="py-4 px-4">
                            <p class="font-bold text-slate-900 dark:text-white text-sm">${req.studentName}</p>
                            <p class="font-mono text-[10px] text-slate-500">${req.regNo}</p>
                        </td>
                        <td class="py-4 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title="${req.courseName}">${req.courseName}</td>
                        <td class="py-4 px-4 text-right">
                            <span class="inline-block px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 font-extrabold rounded-lg border border-amber-200 dark:border-amber-800/50">₹${req.amount}</span>
                        </td>
                        <td class="py-4 px-4 text-center">
                            <div class="flex items-center justify-center gap-2" id="action-box-${req.id}">
                                <button onclick="window.processFeeRequest('${req.id}', '${req.regNo}', '${req.courseName}', ${req.amount}, 'Approve')" class="p-2 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg transition-colors" title="Approve Payment"><i data-lucide="check" class="w-4 h-4"></i></button>
                                <button onclick="window.processFeeRequest('${req.id}', null, null, null, 'Reject')" class="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors" title="Reject Payment"><i data-lucide="x" class="w-4 h-4"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });

        if (tbody.innerHTML === '') {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500 font-medium">No pending verification requests.</td></tr>`;
        }
        if (notifList.innerHTML === '') {
            notifList.innerHTML = `<li class="p-3 text-center text-slate-500 text-xs">No pending requests.</li>`;
        }

        window.pendingFeeCount = pendingCount; 
        window.updateAdminBell();
        if (window.lucide) lucide.createIcons();
    });
}

// 5. The Approval Ledger Logic
window.processFeeRequest = async function (reqId, regNo, courseName, amount, actionType) {
    const box = document.getElementById(`action-box-${reqId}`);
    const ogHtml = box.innerHTML;
    box.innerHTML = `<div class="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>`;

    try {
        if (actionType === 'Approve') {
            const courseTotalFee = window.globalCoursePrices[courseName];
            if (courseTotalFee === undefined || courseTotalFee === "" || isNaN(courseTotalFee)) {
                window.showToast(`Action Blocked: Please set the Course Pricing for ${courseName} first!`, "error");
                box.innerHTML = ogHtml;
                if (window.lucide) lucide.createIcons();
                return;
            }

            const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;
            const response = await fetch(targetUrl, {
                method: 'POST',
                body: new URLSearchParams({
                    action: 'approveFee',
                    regNo: regNo,
                    amount: amount,
                    courseFee: courseTotalFee
                })
            });

            const result = await response.json();
            if (result.status !== 'success') throw new Error("GAS Math Failed");
        }

        const docRef = doc(db, "fee_requests", reqId);
        await updateDoc(docRef, { status: actionType === 'Approve' ? 'Approved' : 'Rejected' });

        window.showToast(`Request ${actionType}d Successfully!`, "success");
    } catch (e) {
        console.error("Fee Process Error:", e);
        window.showToast("System failed to process request.", "error");
        box.innerHTML = ogHtml;
        if (window.lucide) lucide.createIcons();
    }
};

// 6. NEW: Admin Fee History Modal
window.openAdminFeeHistory = function () {
    const modal = document.getElementById('adminFeeHistoryModal');
    const list = document.getElementById('adminFeeHistoryList');
    modal.classList.remove('hidden');
    list.innerHTML = `<div class="flex justify-center py-10"><div class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>`;

    try {
        const q = query(collection(db, "fee_requests"), where("branch", "==", window.currentBranch));

        // BUG 1 FIXED: Removed the invalid getDoc(q) line that was causing the crash!

        onSnapshot(q, (snap) => {
            let reqArray = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'Pending') reqArray.push(data); // Only show processed
            });

            reqArray.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

            if (reqArray.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-500 py-6 font-medium">No processed requests found.</p>`;
                return;
            }

            list.innerHTML = reqArray.map(req => {
                const dateStr = req.timestamp ? new Date(req.timestamp.toMillis()).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "Unknown";
                const badge = req.status === 'Approved'
                    ? `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase rounded-md border border-emerald-200"><i data-lucide="check" class="w-3 h-3 inline"></i> Approved</span>`
                    : `<span class="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-extrabold uppercase rounded-md border border-red-200"><i data-lucide="x" class="w-3 h-3 inline"></i> Rejected</span>`;

                return `
                    <div class="mb-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex justify-between items-center">
                        <div>
                            <p class="font-bold text-slate-900 dark:text-white text-sm">${req.studentName} <span class="text-xs font-normal text-slate-500 font-mono ml-2">(${req.regNo})</span></p>
                            <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">${req.courseName}</p>
                            <p class="text-[10px] text-slate-400 mt-1">${dateStr}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-extrabold text-blue-600 dark:text-blue-400 mb-2">₹${req.amount}</p>
                            ${badge}
                        </div>
                    </div>
                `;
            }).join('');
            if (window.lucide) lucide.createIcons();
        });
    } catch (e) {
        list.innerHTML = `<p class="text-center text-red-500 py-6 font-medium">Failed to load history.</p>`;
    }
};

window.closeAdminFeeHistory = function () {
    document.getElementById('adminFeeHistoryModal').classList.add('hidden');
};

// ============================================================================
// --- SUPPORT ENGINE (ADMIN SIDE) ---
// ============================================================================

window.supportListUnsubscribe = null;
window.activeChatUnsubscribe = null;

// 1. Start the Background Listener (Fires in loadTableData)
window.startSupportChatListListener = function() {
    if(window.supportListUnsubscribe) window.supportListUnsubscribe();

    const listContainer = document.getElementById('adminSupportList');
    const notifList = document.getElementById('support-notif-list');
    
    // We listen to all chats, sorted by newest activity
    const q = query(collection(db, "support_chats"), orderBy("timestamp", "desc"));

    window.supportListUnsubscribe = onSnapshot(q, (snapshot) => {
        listContainer.innerHTML = '';
        notifList.innerHTML = '';
        let unreadCount = 0;

        if(snapshot.empty) {
            listContainer.innerHTML = `<div class="text-center text-xs text-slate-500 mt-10">No messages yet.</div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const hasUnread = data.unreadAdmin > 0;
            if(hasUnread) unreadCount++;

            const timeStr = data.timestamp ? new Date(data.timestamp.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            const activeClass = (document.getElementById('adminActiveChatEmail').value === data.email) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-transparent hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800';
            const dotHtml = hasUnread ? `<span class="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0 animate-pulse"></span>` : '';

            // Render Left Sidebar List
            listContainer.innerHTML += `
                <div onclick="window.openAdminChat('${data.email}', '${data.studentName}')" class="p-3 rounded-xl border ${activeClass} cursor-pointer transition-colors flex items-center justify-between gap-3 group">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline mb-1">
                            <h4 class="text-sm font-bold text-slate-800 dark:text-white truncate">${data.studentName}</h4>
                            <span class="text-[10px] text-slate-400 shrink-0">${timeStr}</span>
                        </div>
                        <p class="text-xs text-slate-500 truncate ${hasUnread ? 'font-bold text-slate-700 dark:text-slate-300' : ''}">${data.lastMessage || 'New interaction'}</p>
                    </div>
                    ${dotHtml}
                </div>
            `;

            // Render Bell Notification Popup
            if(hasUnread) {
                notifList.innerHTML += `
                    <li onclick="window.setFilterStatus('support'); window.openAdminChat('${data.email}', '${data.studentName}'); window.toggleAdminNotification();" class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md transition-all relative">
                        <span class="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></span>
                        <span class="font-bold block text-orange-600 text-xs mb-1 flex items-center gap-1"><i data-lucide="message-circle" class="w-3 h-3"></i> Support Ticket</span>
                        <p class="text-xs text-slate-700 dark:text-slate-300"><b>${data.studentName}</b> needs help.</p>
                    </li>
                `;
            }
        });

        // Manage UI states based on counts
        window.pendingSupportCount = unreadCount; 
        window.updateAdminBell();
        if (window.lucide) lucide.createIcons();
    });
};

// 2. Open a Chat Window
window.openAdminChat = async function(email, studentName) {
    document.getElementById('adminChatCover').classList.add('hidden');
    document.getElementById('adminActiveChatEmail').value = email;
    document.getElementById('adminChatHeaderName').innerText = studentName;
    document.getElementById('adminChatHeaderEmail').innerText = email;

    // Clear previous listener
    if(window.activeChatUnsubscribe) window.activeChatUnsubscribe();

    const chatArea = document.getElementById('adminSupportChatArea');
    
    // Mark as read in Firebase
    await setDoc(doc(db, "support_chats", email), { unreadAdmin: 0 }, { merge: true });

    // Listen to specific messages
    const q = query(collection(db, `support_chats/${email}/messages`), orderBy("timestamp", "asc"));
    
    window.activeChatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatArea.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const isMe = data.sender === 'admin';
            const time = data.timestamp ? new Date(data.timestamp.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
            
            if(isMe) {
                chatArea.innerHTML += `
                    <div class="flex flex-col items-end w-full animate-fade-in-up">
                        <div class="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm text-sm">${data.text}</div>
                        <span class="text-[9px] text-slate-400 mt-1 mr-1">${time}</span>
                    </div>`;
            } else {
                chatArea.innerHTML += `
                    <div class="flex flex-col items-start w-full animate-fade-in-up">
                        <div class="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-2xl rounded-tl-sm max-w-[80%] shadow-sm text-sm">${data.text}</div>
                        <span class="text-[9px] text-slate-400 mt-1 ml-1">${time}</span>
                    </div>`;
            }
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    });
};

// 3. Admin Sending a Reply
const adminChatForm = document.getElementById('adminSupportChatForm');
if(adminChatForm) {
    adminChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('adminSupportInput');
        const email = document.getElementById('adminActiveChatEmail').value;
        const text = input.value.trim();
        
        if(!text || !email) return;
        input.value = ''; // UI Clear

        try {
            await setDoc(doc(db, "support_chats", email), {
                lastMessage: text,
                timestamp: serverTimestamp(),
                unreadStudent: 1 // Notify Student!
            }, { merge: true });

            await addDoc(collection(db, `support_chats/${email}/messages`), {
                text: text,
                sender: 'admin',
                timestamp: serverTimestamp()
            });
        } catch (err) {
            window.showToast("Failed to send message", "error");
        }
    });
}

// 4. Close Active Chat Window (Keeps in list)
window.closeAdminChatView = function() {
    document.getElementById('adminChatCover').classList.remove('hidden');
    document.getElementById('adminActiveChatEmail').value = '';
    if(window.activeChatUnsubscribe) window.activeChatUnsubscribe();
    
    // Remove active highlight from the left list
    const activeItems = document.querySelectorAll('#adminSupportList .bg-blue-50');
    activeItems.forEach(item => {
        item.classList.remove('bg-blue-50', 'border-blue-200', 'dark:bg-blue-900/20', 'dark:border-blue-800');
        item.classList.add('bg-white', 'border-transparent', 'hover:bg-slate-50', 'dark:bg-slate-900', 'dark:hover:bg-slate-800');
    });
};

// 5. Resolve Ticket (Removes from list permanently)
window.resolveSupportTicket = async function() {
    const email = document.getElementById('adminActiveChatEmail').value;
    if(!email) return;
    
    if(!confirm("Resolve this ticket? This will remove the chat from your active list.")) return;

    try {
        await deleteDoc(doc(db, "support_chats", email));
        window.showToast("Ticket Resolved & Closed", "success");
        window.closeAdminChatView(); // Hide the window
    } catch(e) {
        window.showToast("Failed to resolve ticket", "error");
    }
};

// ============================================================================
// --- EXAM DASHBOARD & COURSE MASTER ENGINE ---
// ============================================================================

window.currentExamTab = 'active';
window.courseMaster = {};

// 1. Fetch the subjects assigned to each course from Firebase
window.fetchCourseMaster = async function() {
    try {
        const docRef = doc(db, "admin_settings", "course_master");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            window.courseMaster = docSnap.data();
        } else {
            // Auto-create default structure if it doesn't exist yet
            window.courseMaster = {
                "DCA": ["Fundamentals of Computer", "MS-Office", "Desk Top Publishing(DTP)", "Web Designing"],
                "PGDCA": ["Fundamentals of Computer", "MS-Office", "TALLY & GST", "C & C++ Programming", "Database Management"]
            };
            await setDoc(docRef, window.courseMaster); 
        }
    } catch (e) { console.error("Failed to load Course Master", e); }
};

window.switchExamTab = function(tabName) {
    window.currentExamTab = tabName;
    window.loadExamDashboard(); 
};

window.loadExamDashboard = async function () {
    const loader = document.getElementById('examLoader');
    const grid = document.getElementById('examApplicationsGrid');
    const branchLabel = document.getElementById('examBranchLabel');

    if (branchLabel) branchLabel.innerText = `Branch: ${window.currentBranch}`;
    if (loader) loader.classList.remove('hidden');

    // Ensure we have the Course Master loaded
    if (Object.keys(window.courseMaster).length === 0) {
        await window.fetchCourseMaster();
    }

    // Update Tab Styles Safely
    const tabActive = document.getElementById('exam-tab-active');
    const tabHistory = document.getElementById('exam-tab-history');
    if (tabActive && tabHistory) {
        tabActive.className = `px-5 py-2 text-sm font-bold rounded-lg transition-all ${window.currentExamTab === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`;
        tabHistory.className = `px-5 py-2 text-sm font-bold rounded-lg transition-all ${window.currentExamTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`;
    }

    try {
        const response = await window.fetchWithRetry(`${EXAM_API_URL}?action=getExams`, { method: 'GET' });
        const text = await response.text();
        const result = JSON.parse(text);

        if (result.status === 'success' && result.data) {
            let branchData = result.data.filter(req => String(req.branch || "").trim().toLowerCase() === String(window.currentBranch).trim().toLowerCase());
            
            // SMART FILTERING: Active vs History
            if (window.currentExamTab === 'active') {
                branchData = branchData.filter(req => req.status === 'Pending' || req.status === 'Partial');
            } else {
                branchData = branchData.filter(req => req.status === 'Completed');
            }

            branchData.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
            renderExamGrid(branchData);
        }
    } catch (error) {
        grid.innerHTML = `<p class="text-red-500 font-medium col-span-full text-center py-10">System encountered an error.</p>`;
    } finally {
        if (loader) loader.classList.add('hidden');
    }
};

function renderExamGrid(data) {
    const grid = document.getElementById('examApplicationsGrid');
    grid.innerHTML = '';

    if (!data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 opacity-60"><p class="text-slate-500 font-medium">No ${window.currentExamTab} exam applications found.</p></div>`;
        return;
    }

    data.forEach(app => {
        let dateStr = app.timestamp ? new Date(app.timestamp).toLocaleDateString('en-IN') : "N/A";
        
        // Dynamic Status Badge
        let statusBadge = '';
        let buttonText = 'Grade Exam';
        let buttonClass = 'bg-indigo-600 hover:bg-indigo-700';

        if (app.status === 'Partial') {
            statusBadge = `<span class="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold uppercase rounded-lg border border-amber-200">Partially Graded</span>`;
            buttonText = 'Resume Grading';
            buttonClass = 'bg-amber-500 hover:bg-amber-600';
        } else if (app.status === 'Completed') {
            statusBadge = `<span class="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold uppercase rounded-lg border border-emerald-200"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> Completed</span>`;
            buttonText = 'View / Edit Marks';
            buttonClass = 'bg-emerald-600 hover:bg-emerald-700';
        } else {
            statusBadge = `<span class="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 text-[10px] font-extrabold uppercase rounded-lg border border-cyan-200">Pending</span>`;
        }

        // We safely pass the examID and Course to the modal
        grid.innerHTML += `
            <div class="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/80 shadow-sm relative group">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="font-bold text-slate-900 dark:text-white">${app.name}</h4>
                        <p class="text-xs font-mono text-slate-500 mt-1">${app.regNo}</p>
                    </div>
                    ${statusBadge}
                </div>
                <div class="space-y-2 mb-4">
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-300"><i data-lucide="book" class="w-4 h-4 inline mr-1"></i> ${app.course}</p>
                    <p class="text-xs text-slate-500">Term: ${app.semester} | Date: ${dateStr}</p>
                </div>
                <button onclick="window.openMarksModal('${app.regNo}', '${app.id}', '${app.course}', '${app.semester}')" class="w-full py-2.5 ${buttonClass} text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <i data-lucide="pen-tool" class="w-4 h-4"></i> ${buttonText}
                </button>
            </div>
        `;
    });
    if (window.lucide) lucide.createIcons();
}
