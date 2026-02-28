import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

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
const URL_ARIKUCHI = "https://script.google.com/macros/s/AKfycbzpgzSFhNvXrTYON3dqHZXNdGnv2uroRimIcl3qR4JQ4Oa0iAVUUVePSgVDC3MMQHaS/exec";
const URL_BAGALS = "https://script.google.com/macros/s/AKfycbwuEjeuSox5oZvmBML69NocNbmLSItB-4QvD4IxW2PULVo9EmyltpzutltqM2chP4TGVA/exec";

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
                // FIX: Do NOT signOut() here, as it logs them out of the student site globally.
                // Instead, gracefully block access and offer an explicit sign-out button.
                resetLoginButton();
                window.showToast("Access Denied: Not an Admin Account.", "error");
                
                const form = document.getElementById('adminLoginForm');
                form.innerHTML = `
                    <div class="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl mb-4 text-sm font-bold text-center border border-red-200 dark:border-red-800">
                        You are logged in with a Student account.<br>Access Denied.
                    </div>
                    <button type="button" onclick="window.handleAdminLogout()" class="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all">
                        Sign Out & Switch Account
                    </button>
                `;
            }
        } catch (error) {
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
    window.loadTableData(branch);
};

window.loadTableData = async function (branch) {
    const loader = document.getElementById('tableLoader');
    loader.classList.remove('hidden');

    const targetUrl = branch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;

    try {
        const response = await fetch(`${targetUrl}?action=getAdminData`);
        const result = await response.json();

        if (result.status === 'success') {
            window.adminData = result.data;
            updateStats(window.adminData);
            window.applyFilters(); // Renders table
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

    window.applyFilters();
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

    // 2. Status Card
    if (window.filters.status !== 'all') {
        filtered = filtered.filter(s => {
            const stat = String(s[21] || 'active').toLowerCase();
            return stat === window.filters.status;
        });
    }

    // 3. Dropdown Filters
    const markFilter = document.getElementById('filterMarksheet').value;
    const certFilter = document.getElementById('filterCert').value;

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
        const marksheetStatus = String(student[22] || 'pending').toLowerCase();
        const certStatus = String(student[24] || 'pending').toLowerCase();

        let statusPill = `<span class="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase rounded-lg border border-amber-200">Active</span>`;
        if (status === 'completed') statusPill = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase rounded-lg border border-emerald-200">Completed</span>`;
        if (status === 'dropout') statusPill = `<span class="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-extrabold uppercase rounded-lg border border-red-200">Dropout</span>`;

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

window.simulateAddMarks = function () {
    window.currentMarksAdded = true;
    if (!window.currentModalState.markLink) window.currentModalState.markLink = "MARKS_ADDED";
    
    const btn = document.getElementById('btnAddMarks');
    btn.innerHTML = `Marks Added <i data-lucide="check-circle" class="w-3 h-3 inline"></i>`;
    btn.className = "px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-300 transition-colors";
    lucide.createIcons();
    window.evaluateModalState();
}

window.generateDocument = function (docType) {
    window.showToast(`Generating ${docType}... please wait.`, "info");
    setTimeout(() => {
        if (docType === 'marksheet') {
            window.currentModalState.msGenerated = true;
            window.currentModalState.markLink = "MOCK_URL";
            window.showToast("Marksheet Generated Successfully!", "success");
        } else {
            window.currentModalState.certGenerated = true;
            window.currentModalState.certLink = "MOCK_URL";
            window.showToast("Certificate Generated Successfully!", "success");
        }
        window.evaluateModalState();
    }, 1500);
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

    student[21] = window.currentModalState.course;
    student[22] = window.currentModalState.marksheet;
    student[24] = window.currentModalState.cert;
    student[23] = window.currentModalState.markLink;
    student[25] = window.currentModalState.certLink;

    const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;

    try {
        await fetch(targetUrl, {
            method: 'POST',
            body: new URLSearchParams({
                action: 'adminSaveStudent',
                regNo: student[1],
                courseStatus: student[21],
                markStatus: student[22],
                certStatus: student[24],
                markLink: student[23],
                certLink: student[25]
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
