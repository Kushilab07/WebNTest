// registrationForm.js

// --- CONFIGURATION ---
const URL_ARIKUCHI = "https://script.google.com/macros/s/AKfycbzmq4_E0L_bZvj9Ok8Flmg9J4pxn54T0aYDxYLAo5cgjWvt9dgBbQTY0kZAfWM5q_8E/exec";
const URL_BAGALS = "https://script.google.com/macros/s/AKfycbzHlXnJYQlV0tm5uvuF_1wSLZWfFE-c2xQruAIq9PASYCf81nBkFOxtBk9aoI0sloc3rw/exec";
const MAX_SIZE = 1 * 1024 * 1024; // 1MB Limit

// --- 1. PRE-FILL DATA (Optional) ---
// If you link from your site like: registrationForm.html?name=John&email=john@test.com
// This code will auto-fill the form!
// window.onload = function() {
//     const params = new URLSearchParams(window.location.search);
//     const nameInput = document.getElementsByName('studentName')[0];
//     const emailInput = document.getElementById('email-field');

//     if(params.has('name') && nameInput) {
//         nameInput.value = params.get('name');
//         nameInput.classList.add('filled-input');
//     }
//     if(params.has('email') && emailInput) {
//         emailInput.value = params.get('email');
//         emailInput.classList.add('filled-input');
//     }
// };
// --- 1. PRE-FILL DATA & DYNAMIC FEES ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Fee Database based on your course categories
    const courseAdmissionFees = {
        // 3 Month Courses (1000/-)
        "Basic Of Computer": "1000",
        "Basics of Computer": "1000", // Fallback for typo
        "DTP": "1000",
        "Tally Prime & Accounting": "1000",
        "Advance Excel with MIS Report": "1000",
        "AI/ML using Python": "1000",
        "Digital Marketing": "1000",
        "Communication skill & Personality Dev": "1000",
        "Office management with Google workspace": "1000",
        "SDP(Skill Development Programme)": "1000",

        // 6 Month Courses (2000/-)
        "Diploma in Computer Application": "2000",
        "Advance Tally Prime with GST": "2000",
        "Diploma in Computer Application in Business (CAB)": "2000",
        "Personal Financial Literacy & Stock Market": "2000",
        "Back office Management & MIS Report": "2000",
        "Data Analyst with Al Technology": "2000",

        // 1 Year Courses (2000/-)
        "Advance Diploma in Computer Application": "2000",
        "Post Graduate Diploma in Computer Application": "2000",
        "Advance Diploma in Financial Accounting with Taxation": "2000",

        // Special Courses (2000/-)
        "Advance Diploma in Computer Application with Al Technology": "2000",
        "Diploma in Computer Teacher Training": "2000",
        "Master Diploma in Computer Application": "2000"
    };

    const courseSelects = document.querySelectorAll('.course-select');
    const feeAmountDisplay = document.querySelector('.payment-box .amount');
    const upiBtn = document.querySelector('.btn-upi');

    // NEW: EWS Logic
    let isEWS = false;
    const ewsRadios = document.querySelectorAll('input[name="ewsCategory"]');
    const ewsUploadSection = document.getElementById('ews-upload-section');

    ewsRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            isEWS = (this.value === 'Yes');
            if (isEWS) {
                ewsUploadSection.classList.remove('hidden');
            } else {
                ewsUploadSection.classList.add('hidden');
                document.getElementById('ewsFile').value = ""; // Clear file if they switch to No
                document.getElementById('ewsFile-name').textContent = "No file added";
            }
            
            // Recalculate fee when EWS status changes
            let currentCourse = "";
            courseSelects.forEach(s => { if(s.value) currentCourse = s.value; });
            updateFee(currentCourse);
        });
    });

    // UPDATED: Fee calculation handles EWS discount
    function updateFee(selectedCourse) {
        if (!selectedCourse) {
            feeAmountDisplay.textContent = `₹ 0/-`;
            return;
        }

        let fee = parseInt(courseAdmissionFees[selectedCourse] || "1000");
        
        // Apply 50% discount if EWS is Yes
        if (isEWS) {
            fee = fee / 2;
        }

        feeAmountDisplay.textContent = `₹ ${fee}/-`;

        if (upiBtn) {
            upiBtn.href = `upi://pay?pa=prasantasarma.niat@oksbi&pn=Prasanta%20Sarma&am=${fee}&cu=INR&tn=Admission/Registration%20Fee`;
        }
    }

    // 3. Listen to changes on ALL course dropdowns
    courseSelects.forEach(select => {
        select.addEventListener('change', function () {
            if (this.value !== "") {
                // Reset other dropdowns so only ONE course can be selected across all categories
                courseSelects.forEach(otherSelect => {
                    if (otherSelect !== this) otherSelect.value = "";
                });
                updateFee(this.value);
            } else {
                // If they cleared the selection, check if any others are active
                const anySelected = Array.from(courseSelects).find(s => s.value !== "");
                updateFee(anySelected ? anySelected.value : null);
            }
        });
    });

    // 4. Auto-Select Course & Email from URL Parameter
    // This grabs data from index.html (e.g., ?email=test@test.com&course=DTP)
    const urlParams = new URLSearchParams(window.location.search);
    const courseFromUrl = urlParams.get('course');
    const emailFromUrl = urlParams.get('email');

    if (emailFromUrl) {
        const emailInput = document.getElementById('email-field');
        if (emailInput) {
            emailInput.value = emailFromUrl;
            
            // 1. Manually add the class to guarantee the UX updates instantly
            emailInput.classList.add('filled-input');
            
            // 2. We keep the blur event just in case any of your other scripts need to know it changed
            emailInput.dispatchEvent(new Event('blur'));
        }
    }

    if (courseFromUrl) {
        const decodedCourse = decodeURIComponent(courseFromUrl).trim().toLowerCase();
        const allCourseSelects = document.querySelectorAll('.course-select');
        let matchedCourseName = ""; // Track the exact name found

        allCourseSelects.forEach(select => {
            let matched = false;
            Array.from(select.options).forEach(option => {
                // Match course name safely
                if (option.value && option.value.toLowerCase().trim() === decodedCourse) {
                    select.value = option.value;
                    matchedCourseName = option.value; // Save the exact formatted name
                    matched = true;
                }
            });

            if (matched) {
                // Triggers fee calculation and background color updates
                select.dispatchEvent(new Event('change'));
            }
        });

        // NEW: If a course was successfully auto-matched, swap the UI!
        if (matchedCourseName !== "") {
            const dropdownView = document.getElementById('dropdown-course-view');
            const lockedView = document.getElementById('locked-course-view');
            const lockedInput = document.getElementById('locked-course-name');

            if (dropdownView && lockedView && lockedInput) {
                // Hide the complex dropdowns
                dropdownView.style.display = 'none';
                // Show the simple locked input
                lockedView.classList.remove('hidden');
                // Inject the course name into the locked input
                lockedInput.value = matchedCourseName;
            }
        }
    }
});

// --- 2. FILE UPLOAD LOGIC ---
function checkFileSize(fileInput) {
    const displayId = fileInput.id + "-name";
    const display = document.getElementById(displayId);

    if (fileInput.files.length > 0) {
        if (fileInput.files[0].size > MAX_SIZE) {
            alert("File is too big! Max size is 1MB.");
            fileInput.value = "";
            if (display) display.textContent = "No file added";
        } else {
            if (display) display.textContent = fileInput.files[0].name;
        }
    } else {
        if (display) display.textContent = "No file added";
    }
}

const photoF = document.getElementById('photoFile');
const docF = document.getElementById('docFile');
const ewsF = document.getElementById('ewsFile');
const payF = document.getElementById('payFile');

if (photoF) photoF.addEventListener('change', function () { checkFileSize(this) });
if (docF) docF.addEventListener('change', function () { checkFileSize(this) });
if (ewsF) ewsF.addEventListener('change', function () { checkFileSize(this) });
if (payF) payF.addEventListener('change', function () { checkFileSize(this) });


// --- 3. PAYMENT MODE TOGGLE ---
const payRadios = document.querySelectorAll('input[name="payMode"]');
const onlineSection = document.getElementById('online-payment-section');

payRadios.forEach(radio => {
    radio.addEventListener('change', function () {
        if (this.value === 'Online') {
            onlineSection.classList.remove('hidden');
        } else {
            onlineSection.classList.add('hidden');
        }
    });
});


// --- 4. COURSE SELECTION LOGIC (Only one at a time) ---
const selects = document.querySelectorAll('.course-select');
selects.forEach(select => {
    select.addEventListener('change', function () {
        if (this.value !== "") {
            selects.forEach(other => {
                if (other !== this) {
                    other.value = "";
                    other.classList.remove('filled-input');
                }
            });
        }
    });
});

// --- 5. HELPER: Read File as Base64 ---
function getFileData(id) {
    return new Promise(resolve => {
        var el = document.getElementById(id);
        if (!el || !el.files[0]) resolve({ data: null, name: null });
        else {
            var file = el.files[0];
            var reader = new FileReader();
            reader.onload = e => resolve({ data: e.target.result, name: file.name });
            reader.readAsDataURL(file);
        }
    });
}


// --- 6. SUBMIT & PREVIEW LOGIC ---
const form = document.getElementById('admissionForm');
const previewModal = document.getElementById('preview-modal');
const previewDataBox = document.getElementById('preview-data');
const finalSubmitBtn = document.getElementById('final-submit-btn');
const editBtn = document.getElementById('edit-btn');
const editBtnAction = document.getElementById('edit-btn-action');

// A. PREVIEW BUTTON CLICK
if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Safely fetch current states directly from the DOM
        const payMode = document.querySelector('input[name="payMode"]:checked').value;
        const isEWS = document.querySelector('input[name="ewsCategory"]:checked').value === 'Yes';

        // Validation
        if (!document.getElementById('declaration').checked) { alert("Please tick the declaration box."); return; }
        if (document.getElementById('photoFile').files.length === 0) { alert("Please upload your Passport Photo."); return; }
        if (document.getElementById('docFile').files.length === 0) { alert("Please upload your Qualification Document."); return; }
        if (isEWS && document.getElementById('ewsFile').files.length === 0) { alert("Please upload your EWS Certificate."); return; }
        if (payMode === 'Online' && document.getElementById('payFile').files.length === 0) { alert("Please upload the Payment Screenshot."); return; }

        // Read Files
        const photoPromise = getFileData('photoFile');
        const docPromise = getFileData('docFile');
        const ewsPromise = isEWS ? getFileData('ewsFile') : Promise.resolve({ data: null, name: "" });
        const payPromise = (payMode === 'Online') ? getFileData('payFile') : Promise.resolve({ data: null, name: "" });

        Promise.all([photoPromise, docPromise, ewsPromise, payPromise]).then(([photoRes, docRes, ewsRes, payRes]) => {
            let selectedCourse = "";
            document.querySelectorAll('.course-select').forEach(s => { if (s.value) selectedCourse = s.value; });

            const fields = [
                { label: "Branch", val: document.getElementById('branch-select').value },
                { label: "Student Name", val: document.getElementsByName('studentName')[0].value },
                { label: "Father's/Guardian's Name", val: document.getElementsByName('fatherName')[0].value },
                { label: "Email", val: document.getElementById('email-field').value },
                { label: "Contact", val: document.getElementsByName('contact')[0].value },
                { label: "Village/Town", val: document.getElementsByName('village')[0].value },
                { label: "Post Office", val: document.getElementsByName('po')[0].value },
                { label: "District", val: document.getElementsByName('district')[0].value },
                { label: "PIN Code", val: document.getElementsByName('pin')[0].value },
                { label: "Qualification", val: document.getElementsByName('qualification')[0].value },
                { label: "Present Activity", val: document.getElementsByName('activity')[0].value },
                { label: "Selected Course", val: selectedCourse },
                { label: "EWS Category", val: isEWS ? "Yes" : "No" },
                { label: "Passport Photo", val: photoRes.data, type: 'image' },
                { label: "Last Qualification Doc", val: docRes.data, type: 'file', fileName: docRes.name },
                { label: "EWS Certificate", val: ewsRes.data, type: 'file', fileName: ewsRes.name },
                { label: "Payment Mode", val: payMode },
                { label: "Payment Screenshot", val: payRes.data, type: 'image' }
            ];

            let htmlTable = `<table class="preview-table">`;
            fields.forEach(field => {
                if (field.val && field.val !== "") {
                    let content = field.val;
                    if (field.type === 'image') {
                        content = `<img src="${field.val}" class="payment-proof-img" onclick="window.open('${field.val}')" title="Click to view">`;
                    } else if (field.type === 'file') {
                        if (field.val.startsWith('data:image')) {
                            content = `<img src="${field.val}" class="payment-proof-img" onclick="window.open('${field.val}')" title="Click to view">`;
                        } else {
                            content = `<a href="${field.val}" target="_blank" class="btn-secondary-sm" style="text-decoration:none;">View PDF</a>`;
                        }
                    }
                    htmlTable += `<tr><td class="pt-label">${field.label}</td><td class="pt-val">${content}</td></tr>`;
                }
            });
            htmlTable += `</table>`;
            previewDataBox.innerHTML = htmlTable;
            previewModal.classList.remove('hidden');
        });
    });
}

// B. CLOSE MODAL
[editBtn, editBtnAction].forEach(btn => {
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); previewModal.classList.add('hidden'); });
});

// C. FINAL SUBMIT
if (finalSubmitBtn) {
    finalSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. FREEZE LAYOUT
        const modalContent = document.querySelector('.modal-content');
        modalContent.style.height = modalContent.offsetHeight + 'px';

        // 2. ANIMATION SETUP
        const rect = finalSubmitBtn.getBoundingClientRect();
        finalSubmitBtn.style.width = rect.width + 'px';
        finalSubmitBtn.style.height = rect.height + 'px';
        finalSubmitBtn.style.left = rect.left + 'px';
        finalSubmitBtn.style.top = rect.top + 'px';
        finalSubmitBtn.style.position = 'fixed';
        void finalSubmitBtn.offsetWidth;

        // 3. START FADE & MOVE
        document.querySelector('.main-wrapper').classList.add('page-fade-out');
        document.querySelector('.bg-pattern').style.opacity = '0';
        document.querySelector('.modal-header').classList.add('modal-content-fade');
        document.querySelector('#preview-data').classList.add('modal-content-fade');
        document.querySelector('.modal-actions').style.border = 'none';
        const editBtnEl = document.getElementById('edit-btn-action');
        if (editBtnEl) editBtnEl.classList.add('modal-content-fade');
        modalContent.style.background = 'transparent';
        modalContent.style.boxShadow = 'none';
        modalContent.style.border = 'none';

        finalSubmitBtn.classList.add('btn-animating');
        requestAnimationFrame(() => {
            finalSubmitBtn.style.top = '50%';
            finalSubmitBtn.style.left = '50%';
            finalSubmitBtn.style.transform = 'translate(-50%, -50%)';
            finalSubmitBtn.style.width = '60px';
            finalSubmitBtn.style.height = '60px';
        });
        finalSubmitBtn.disabled = true;

        // 4. PREPARE DATA
        const payMode = document.querySelector('input[name="payMode"]:checked').value;
        const isEWS = document.querySelector('input[name="ewsCategory"]:checked').value === 'Yes';
        
        const filePromises = [
            getFileData('photoFile'),
            getFileData('docFile'),
            isEWS ? getFileData('ewsFile') : Promise.resolve({ data: "", name: "" }),
            (payMode === 'Online') ? getFileData('payFile') : Promise.resolve({ data: "", name: "" })
        ];

        Promise.all(filePromises).then(files => {
            const branchValue = document.getElementById('branch-select').value;
            let targetURL = (branchValue === "Arikuchi") ? URL_ARIKUCHI : URL_BAGALS;

            var formData = {
                branch: branchValue,
                studentName: document.getElementsByName('studentName')[0].value,
                fatherName: document.getElementsByName('fatherName')[0].value,
                email: document.getElementById('email-field').value,
                contact: document.getElementsByName('contact')[0].value,
                village: document.getElementsByName('village')[0].value,
                po: document.getElementsByName('po')[0].value,
                district: document.getElementsByName('district')[0].value,
                pin: document.getElementsByName('pin')[0].value,
                qualification: document.getElementsByName('qualification')[0].value,
                activity: document.getElementsByName('activity')[0].value,
                course3m: document.getElementsByName('course3m')[0].value,
                course6m: document.getElementsByName('course6m')[0].value,
                course1y: document.getElementsByName('course1y')[0].value,
                courseSp: document.getElementsByName('courseSp')[0].value,
                notes: document.getElementsByName('notes')[0].value,
                paymentMode: payMode,
                photoData: files[0].data, photoName: files[0].name,
                docData: files[1].data, docName: files[1].name,
                ewsData: files[2].data, ewsName: files[2].name,
                payData: files[3].data, payName: files[3].name
            };

            const serialDisplay = document.getElementById('serial-display');
            if (serialDisplay) serialDisplay.innerHTML = 'Generating...';

            const preventLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
            window.addEventListener('beforeunload', preventLeave);

            const uploadPromise = fetch(targetURL, { method: 'POST', body: JSON.stringify(formData) }).then(r => r.json());
            const timerPromise = new Promise(resolve => setTimeout(resolve, 2500));

            Promise.all([uploadPromise, timerPromise]).then(([data, timerResult]) => {
                window.removeEventListener('beforeunload', preventLeave);

                if (data.status === 'success') {
                    document.getElementById('final-spinner').style.display = 'none';
                    const checkIcon = document.getElementById('btn-check');
                    if (checkIcon) {
                        checkIcon.classList.remove('hidden-check');
                        checkIcon.classList.add('checkmark-show');
                    }
                    finalSubmitBtn.classList.add('btn-success-state');

                    setTimeout(() => {
                        previewModal.classList.add('hidden');
                        document.querySelector('.main-wrapper').style.display = 'none';
                        const successView = document.getElementById('success-view');
                        successView.classList.remove('hidden');
                        successView.classList.add('fullscreen-success');
                        if (serialDisplay) serialDisplay.textContent = data.serial;
                    }, 1200);

                } else {
                    alert("Submission Failed: " + data.message);
                    location.reload();
                }
            }).catch(error => {
                window.removeEventListener('beforeunload', preventLeave);
                alert("Network Error: " + error);
                location.reload();
            });
        });
    });
}

// --- 7. FIELD COLOR LOGIC ---
document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input[type='number'], textarea, select");
    inputs.forEach(input => {
        const updateColor = () => {
            if (input.value.trim() !== "") input.classList.add("filled-input");
            else input.classList.remove("filled-input");
        };
        input.addEventListener("blur", updateColor);
        if (input.tagName === "SELECT") input.addEventListener("change", updateColor);
        input.addEventListener("focus", function () { this.classList.remove("filled-input"); });
    });
});

// --- 8. DISABLE SHORTCUTS ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) || (e.ctrlKey && e.key === "u")) {
        e.preventDefault();
    }
});

// --- 9. DESKTOP QR CODE LOGIC ---
// document.addEventListener("DOMContentLoaded", function () {
//     const upiBtn = document.querySelector('.btn-upi');
//     const qrModal = document.getElementById('qr-modal');
//     const qrContainer = document.getElementById('qr-container');
//     const qrSpinner = document.getElementById('qr-spinner');
//     const timerDisplay = document.getElementById('qr-timer');
//     const doneBtn = document.getElementById('qr-done-btn');
    
//     let timerInterval;

//     // Device Detection (Simple regex for mobile platforms)
//     const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

//     if (upiBtn) {
//         upiBtn.addEventListener('click', function(e) {
//             if (!isMobile) {
//                 // If it is a desktop, stop the default link behavior
//                 e.preventDefault();
                
//                 // Get the current dynamic UPI URL from the button's href
//                 const upiUrl = this.href;

//                 // Show Modal & Spinner
//                 qrModal.classList.remove('hidden');
//                 qrContainer.innerHTML = ''; 
//                 qrContainer.appendChild(qrSpinner);
//                 qrSpinner.style.display = 'block';

//                 // Simulate loading animation for 1 second, then generate QR
//                 setTimeout(() => {
//                     qrSpinner.style.display = 'none';
                    
//                     // Generate QR Code using the library
//                     new QRCode(qrContainer, {
//                         text: upiUrl,
//                         width: 200,
//                         height: 200,
//                         colorDark : "#000000",
//                         colorLight : "#ffffff",
//                         correctLevel : QRCode.CorrectLevel.H
//                     });

//                     // Start 10-minute timer
//                     startTimer(10 * 60);
//                 }, 1000);
//             }
//             // If it is mobile, do nothing (allow default behavior to open UPI app)
//         });
//     }

//     function startTimer(durationInSeconds) {
//         clearInterval(timerInterval);
//         let timer = durationInSeconds;
        
//         timerInterval = setInterval(function () {
//             let minutes = parseInt(timer / 60, 10);
//             let seconds = parseInt(timer % 60, 10);

//             minutes = minutes < 10 ? "0" + minutes : minutes;
//             seconds = seconds < 10 ? "0" + seconds : seconds;

//             timerDisplay.textContent = minutes + ":" + seconds;

//             if (--timer < 0) {
//                 clearInterval(timerInterval);
//                 timerDisplay.textContent = "Expired";
//                 alert("Payment session expired. Please try again.");
//                 closeQRModal();
//             }
//         }, 1000);
//     }

//     function closeQRModal() {
//         qrModal.classList.add('hidden');
//         clearInterval(timerInterval);
//     }

//     if (doneBtn) {
//         doneBtn.addEventListener('click', function(e) {
//             e.preventDefault();
//             closeQRModal();
//             // Optional: You could auto-focus the file upload button here
//             document.getElementById('payFile').click(); 
//         });
//     }
// });

// --- 9. DESKTOP QR CODE LOGIC (ROBUST VERSION) ---
document.addEventListener("DOMContentLoaded", function () {
    const upiBtn = document.querySelector('.btn-upi');
    const qrModal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qr-container');
    const timerDisplay = document.getElementById('qr-timer');
    const doneBtn = document.getElementById('qr-done-btn');
    
    let timerInterval;

    // ROBUST DEVICE DETECTION: Handles "Desktop Mode" spoofing on mobile browsers
    // ROBUST DEVICE DETECTION (Modern, warning-free approach)
    const isMobile = 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
        window.matchMedia("(pointer: coarse)").matches || 
        (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

    if (upiBtn) {
        upiBtn.addEventListener('click', function(e) {
            if (!isMobile) {
                // If Desktop: Intercept click
                e.preventDefault();
                const upiUrl = this.href;

                // Reset and show modal
                qrModal.classList.remove('hidden');
                
                // Inject Spinner reliably
                qrContainer.innerHTML = '<div class="spinner" style="display: block; border-color: var(--slate-200); border-top-color: var(--primary);"></div>';

                // Lock the Done button initially
                doneBtn.disabled = true;
                doneBtn.style.opacity = '0.5';
                doneBtn.style.cursor = 'not-allowed';

                // Simulate brief loading, then show QR
                setTimeout(() => {
                    qrContainer.innerHTML = ''; // Clear spinner
                    new QRCode(qrContainer, {
                        text: upiUrl,
                        width: 200,
                        height: 200,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });

                    // Start robust 10 min timer & 30s button lock
                    startRobustTimer(10 * 60);
                }, 1000);
            }
            // Mobile users will pass right through to their UPI app natively
        });
    }

    function startRobustTimer(durationInSeconds) {
        clearInterval(timerInterval);
        
        // Calculate exact absolute times (immune to tab throttling)
        const endTime = Date.now() + (durationInSeconds * 1000);
        const enableTime = Date.now() + (10 * 1000); // 10 seconds from now

        updateTimerDisplay(endTime, enableTime);

        timerInterval = setInterval(() => {
            updateTimerDisplay(endTime, enableTime);
        }, 1000);
    }

    function updateTimerDisplay(endTime, enableTime) {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const totalSeconds = Math.floor(remaining / 1000);

        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = minutes + ":" + seconds;

        // Button Unlock Logic (30 Seconds)
        if (now >= enableTime && doneBtn.disabled) {
            doneBtn.disabled = false;
            doneBtn.style.opacity = '1';
            doneBtn.style.cursor = 'pointer';
            doneBtn.textContent = "Payment Done";
        }

        // Expiration Logic (10 Minutes)
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = "Expired";
            alert("Payment session expired. Please click 'Pay via UPI App' to generate a new QR code.");
            qrModal.classList.add('hidden');
        }
    }

    if (doneBtn) {
        doneBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (this.disabled) return; // Prevent click if still locked
            
            // Close the QR Modal
            qrModal.classList.add('hidden');
            clearInterval(timerInterval);
        });
    }
});
