import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

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

// STRICT ADMIN SECURITY: Wipe session when tab closes
setPersistence(auth, browserSessionPersistence).catch(console.error);

// REPLACE THESE WITH YOUR ACTUAL GOOGLE APPS SCRIPT WEB APP URLs
const URL_ARIKUCHI = "https://script.google.com/macros/s/AKfycbwALBsVTdQMzC8AONWISYIWYETy4tgLHvlZByD9dIfRy8zSdRM4e35Bi-M9B2e1y5j5/exec";
const URL_BAGALS = "https://script.google.com/macros/s/AKfycbyXo00ncMu3M8mKaXHFK24iY6KE6SmnB5krLBNLotqOkg2Wfa3TeJWqXQPCZp_4LwbOEA/exec";

window.adminData = []; 
window.currentEditingRegNo = null; 
window.currentBranch = 'Arikuchi';
let sortDirection = 1;

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

// --- HELPER: RESET LOGIN BUTTON ---
// FIX: This stops the infinite loading spinner if Firestore rejects the admin.
const resetLoginButton = () => {
    const btn = document.getElementById('loginBtn');
    if (btn) {
        btn.innerHTML = `<span id="loginBtnText">Authenticate</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
        btn.disabled = false;
        if(window.lucide) lucide.createIcons();
    }
};

// --- THE INVISIBLE GATE (AUTH LISTENER) ---
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard-screen');

    if (user) {
        try {
            const adminDocRef = doc(db, 'admins', user.email);
            const adminDoc = await getDoc(adminDocRef);

            // VERIFICATION SUCCESS
            if (adminDoc.exists()) {
                loginScreen.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => {
                    loginScreen.classList.add('hidden');
                    dashboard.classList.remove('hidden');
                    setTimeout(() => dashboard.classList.remove('opacity-0'), 50);
                    window.loadTableData(window.currentBranch);
                }, 300);
            } 
            // VERIFICATION FAILED
            else {
                await signOut(auth);
                window.showToast("Unauthorized Access. Incident Logged.", "error");
                resetLoginButton(); // Stops the spinner!
            }
        } catch (error) {
            console.error("Verification Error:", error);
            await signOut(auth);
            window.showToast("Database verification failed. Check Firestore Rules.", "error");
            resetLoginButton(); // Stops the spinner!
        }
    } else {
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
        resetLoginButton();
    }
});

// --- LOGOUT ACTION ---
window.handleAdminLogout = async () => {
    await signOut(auth);
    window.showToast("Securely logged out.", "success");
    setTimeout(() => window.location.reload(), 1000);
};

// --- UI TOGGLES ---
window.switchBranch = function(branch) {
    if (window.currentBranch === branch) return;
    window.currentBranch = branch;
    
    const btnAri = document.getElementById('btn-arikuchi');
    const btnBag = document.getElementById('btn-bagals');
    
    if(branch === 'Arikuchi') {
        btnAri.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm transition-all";
        btnBag.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap";
    } else {
        btnBag.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm transition-all";
        btnAri.className = "flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap";
    }
    
    window.loadTableData(branch);
};

// --- DATA FETCHING ---
window.loadTableData = async function(branch) {
    const loader = document.getElementById('tableLoader');
    loader.classList.remove('hidden');
    
    // Choose which script to pull from based on the toggle
    const targetUrl = branch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;
    
    try {
        // Request the new getAdminData action from GAS
        const response = await fetch(`${targetUrl}?action=getAdminData`);
        const result = await response.json();
        
        if (result.status === 'success') {
            window.adminData = result.data; // Store full array in memory
            updateStats(window.adminData);
            renderTable(window.adminData);
        } else {
            window.showToast("Failed to fetch data from Sheet.", "error");
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        window.showToast("Network Error. Check console.", "error");
    } finally {
        loader.classList.add('hidden');
    }
};

// --- STATS ENGINE ---
function updateStats(data) {
    let active = 0;
    let completed = 0;
    data.forEach(s => {
        const stat = String(s[21] || '').toLowerCase(); // Index 21 is Course Status
        if(stat === 'completed') completed++;
        else if(stat !== 'dropout') active++; // Assume Active if not completed or dropout
    });
    
    document.getElementById('statTotal').innerText = data.length;
    document.getElementById('statActive').innerText = active;
    document.getElementById('statCompleted').innerText = completed;
}

// --- SEARCH & SORT ENGINE ---
document.getElementById('adminSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = window.adminData.filter(student => {
        const regNo = String(student[1] || '').toLowerCase(); // Index 1 is Reg No
        const name = String(student[2] || '').toLowerCase();  // Index 2 is Name
        return regNo.includes(query) || name.includes(query);
    });
    renderTable(filtered);
});

window.sortTable = function(colIndex) {
    sortDirection *= -1; // Toggle direction
    const sorted = [...window.adminData].sort((a, b) => {
        const valA = String(a[colIndex] || '').toLowerCase();
        const valB = String(b[colIndex] || '').toLowerCase();
        if (valA < valB) return -1 * sortDirection;
        if (valA > valB) return 1 * sortDirection;
        return 0;
    });
    renderTable(sorted);
}

// --- TABLE RENDERING ---
function renderTable(dataArray) {
    const tbody = document.getElementById('masterTableBody');
    tbody.innerHTML = '';

    if (dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">No records found.</td></tr>`;
        return;
    }

    dataArray.forEach((student) => {
        const regNo = student[1]; 
        const name = student[2];
        const course = student[11];
        const attendance = student[20] || '0%';
        const status = String(student[21] || 'active').toLowerCase(); 
        const marksheetStatus = String(student[22] || 'pending').toLowerCase();
        const certStatus = String(student[24] || 'pending').toLowerCase();

        // Status Pill
        let statusPill = `<span class="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase rounded-lg border border-amber-200">Active</span>`;
        if(status === 'completed') statusPill = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase rounded-lg border border-emerald-200">Completed</span>`;
        if(status === 'dropout') statusPill = `<span class="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-extrabold uppercase rounded-lg border border-red-200">Dropout</span>`;

        // Document Indicators (Icons instead of just dots)
        const markHtml = marksheetStatus === 'completed' 
            ? `<a href="${student[23] || '#'}" target="_blank" title="Marksheet Ready" class="text-purple-500 hover:scale-110 transition-transform"><i data-lucide="file-check-2" class="w-4 h-4"></i></a>` 
            : `<span class="w-1.5 h-1.5 rounded-full bg-slate-300" title="Marksheet Pending"></span>`;
            
        const certHtml = certStatus === 'completed' 
            ? `<a href="${student[25] || '#'}" target="_blank" title="Certificate Ready" class="text-blue-500 hover:scale-110 transition-transform"><i data-lucide="award" class="w-4 h-4"></i></a>` 
            : `<span class="w-1.5 h-1.5 rounded-full bg-slate-300" title="Certificate Pending"></span>`;

        const row = `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <td class="py-4 px-4 font-mono text-xs text-slate-500">${regNo}</td>
                <td class="py-4 px-4 font-bold text-slate-900 dark:text-white">${name}</td>
                <td class="py-4 px-4 text-slate-600 dark:text-slate-400 text-xs">${course}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-2 cursor-pointer" onclick="window.promptAttendanceEdit('${regNo}', '${attendance}')">
                        <span class="font-bold text-blue-600">${attendance}</span>
                        <i data-lucide="edit-2" class="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                </td>
                <td class="py-4 px-4">${statusPill}</td>
                <td class="py-4 px-4 flex gap-2 items-center h-full mt-2">
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

    if(window.lucide) lucide.createIcons();
}

// --- CSV EXPORT ENGINE ---
window.exportToCSV = function() {
    if(window.adminData.length === 0) {
        window.showToast("No data to export", "info");
        return;
    }
    
    // Define Headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Reg No,Student Name,Course,Attendance,Status,Marksheet Status,Certificate Status\n";
    
    window.adminData.forEach(row => {
        // Strip out commas from strings to prevent CSV breaking
        const reg = String(row[1] || '').replace(/,/g, '');
        const name = String(row[2] || '').replace(/,/g, '');
        const course = String(row[11] || '').replace(/,/g, '');
        const att = String(row[20] || '0%').replace(/,/g, '');
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
window.promptAttendanceEdit = async function(regNo, currentVal) {
    const newVal = prompt(`Update Attendance for ${regNo}:`, currentVal);
    if (newVal !== null && newVal !== currentVal) {
        window.showToast("Updating attendance...", "info");
        
        const studentIndex = window.adminData.findIndex(s => s[1] === regNo);
        if(studentIndex > -1) {
            window.adminData[studentIndex][20] = newVal;
            renderTable(window.adminData);
        }

        const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;

        try {
            await fetch(targetUrl, {
                method: 'POST',
                body: new URLSearchParams({
                    action: 'adminUpdateCell',
                    regNo: regNo,
                    colIndex: 20, // Column U
                    value: newVal
                })
            });
            window.showToast("Attendance Saved!", "success");
        } catch (error) {
            window.showToast("Failed to save to database.", "error");
        }
    }
}

// --- MODAL LOGIC (Manage Student) ---
window.openManageModal = function(regNo) {
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

    document.getElementById('modalStudentName').innerText = student[2];
    document.getElementById('modalRegNo').innerText = regNo;
    
    // Capitalize first letter for select box matching
    let currentStatus = student[21] || 'Active';
    currentStatus = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).toLowerCase();
    
    // If the sheet has empty or weird data, default to Active
    if(!['Active', 'Completed', 'Dropout'].includes(currentStatus)) currentStatus = 'Active';
    document.getElementById('modalCourseStatus').value = currentStatus;
    
    const markStatus = String(student[22] || 'pending').toLowerCase();
    const certStatus = String(student[24] || 'pending').toLowerCase();
    
    document.getElementById('marksheetCurrentStatus').innerText = markStatus.toUpperCase();
    document.getElementById('certCurrentStatus').innerText = certStatus.toUpperCase();
    
    updateToggleButton('btnMarksheetToggle', markStatus);
    updateToggleButton('btnCertToggle', certStatus);

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('translate-x-full');
    });
};

window.closeManageModal = function() {
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

// --- MODAL DOCUMENT TOGGLES ---
window.toggleDocumentStatus = function(docType) {
    const student = window.adminData.find(s => s[1] === window.currentEditingRegNo);
    if (!student) return;

    if (docType === 'marksheet') {
        const current = String(student[22] || 'pending').toLowerCase();
        student[22] = current === 'completed' ? 'pending' : 'completed';
        document.getElementById('marksheetCurrentStatus').innerText = student[22].toUpperCase();
        updateToggleButton('btnMarksheetToggle', student[22]);
    } else {
        const current = String(student[24] || 'pending').toLowerCase();
        student[24] = current === 'completed' ? 'pending' : 'completed';
        document.getElementById('certCurrentStatus').innerText = student[24].toUpperCase();
        updateToggleButton('btnCertToggle', student[24]);
    }
};

function updateToggleButton(btnId, status) {
    const btn = document.getElementById(btnId);
    if (status === 'completed') {
        btn.className = "px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-colors bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200";
        btn.innerText = "Revert to Pending";
    } else {
        btn.className = "px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-colors bg-white border border-slate-300 text-slate-700 hover:bg-slate-50";
        btn.innerText = "Set Completed";
    }
}

// --- SAVE EDITS BUTTON ---
window.saveStudentEdits = async function() {
    const btn = document.getElementById('btnSaveEdits');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...`;
    btn.disabled = true;

    const student = window.adminData.find(s => s[1] === window.currentEditingRegNo);
    student[21] = document.getElementById('modalCourseStatus').value;
    
    const targetUrl = window.currentBranch === 'Arikuchi' ? URL_ARIKUCHI : URL_BAGALS;

    try {
        await fetch(targetUrl, {
            method: 'POST',
            body: new URLSearchParams({
                action: 'adminSaveStudent',
                regNo: student[1],
                courseStatus: student[21], // Index 21
                markStatus: student[22] || 'Pending',   // Index 22
                certStatus: student[24] || 'Pending'    // Index 24
            })
        });
        
        window.showToast("Student profile updated!", "success");
        updateStats(window.adminData);
        renderTable(window.adminData); 
        window.closeManageModal();
    } catch (error) {
        window.showToast("Failed to save changes.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        if(window.lucide) lucide.createIcons();
    }
};
