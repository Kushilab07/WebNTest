document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- PASTE YOUR URLS HERE ---
    const URL_ARIKUCHI = "https://script.google.com/macros/s/AKfycbyP_ScGUXfaUqYAf0N73oQUkkIcxstuebeJ5rACvvsWdK11yDwuRrf95JKnpeDuj9wv/exec";
    const URL_BAGALS = "https://script.google.com/macros/s/AKfycbz0gI2OJDcwyI-J4SR3P9SrDUJoRKd6J_h68YZ0at3OLJKjT4dQRSxsc-pASKzQuR2thw/exec";
    const EXAM_API_URL = "https://script.google.com/macros/s/AKfycbzm2qrBOHNyhOW7NQ3q2mvkIjlECqyOrtLettA7z2Et6GKMm0DzjwVLlRFeJ6uwQ23NNw/exec";

    // 1. UI Elements
    const stateLoading = document.getElementById('state-loading');
    const stateUnregistered = document.getElementById('state-unregistered');
    const stateDeclaration = document.getElementById('state-declaration');
    const stateForm = document.getElementById('state-form');
    const stateSuccess = document.getElementById('state-success');

    const declarationCheck = document.getElementById('fee-declaration');
    const btnContinue = document.getElementById('btn-continue');

    const courseSelect = document.getElementById('ex-course');
    const branchInput = document.getElementById('ex-branch');
    const regnoInput = document.getElementById('ex-regno');
    const durationInput = document.getElementById('ex-duration');
    const semesterWrapper = document.getElementById('semester-wrapper');
    const semesterSelect = document.getElementById('ex-semester');

    let globalEnrolledCourses = []; // Stores the objects fetched from sheets

    // 2. Extract Email
    const urlParams = new URLSearchParams(window.location.search);
    const userEmail = urlParams.get('email');

    if (!userEmail) {
        alert("Session missing. Please login first.");
        window.location.href = 'index.html';
        return;
    }

    // 3. Database: Course to Duration Mapping
    const courseDurations = {
        "Basic Of Computer": "3 Months", "Basics of Computer": "3 Months", "DTP": "3 Months", "Tally Prime & Accounting": "3 Months", "Advance Excel with MIS Report": "3 Months", "AI/ML using Python": "3 Months", "Digital Marketing": "3 Months", "Communication skill & Personality Dev": "3 Months", "Communication Skill & Personality Development": "3 Months", "Office management with Google workspace": "3 Months", "Office Management with Google workspace": "3 Months", "SDP(Skill Development Programme)": "3 Months",
        "Diploma in Computer Application": "6 Months", "Advance Tally Prime with GST": "6 Months", "Diploma in Computer Application in Business (CAB)": "6 Months", "Personal Financial Literacy & Stock Market": "6 Months", "Back office Management & MIS Report": "6 Months", "Data Analyst with Al Technology": "6 Months",
        "Advance Diploma in Computer Application": "1 Year", "Post Graduate Diploma in Computer Application": "1 Year", "Advance Diploma in Financial Accounting with Taxation": "1 Year",
        "Advance Diploma in Computer Application with Al Technology": "18 Months", "Diploma in Computer Teacher Training": "18 Months",
        "Master Diploma in Computer Application": "24 Months"
    };

    // 4. API VERIFICATION (PARALLEL FETCHING)
    async function verifyEnrollment(email) {
        try {
            const encodedEmail = encodeURIComponent(email);

            const reqArikuchi = fetch(`${URL_ARIKUCHI}?email=${encodedEmail}`).then(res => res.json()).catch(() => null);
            const reqBagals = fetch(`${URL_BAGALS}?email=${encodedEmail}`).then(res => res.json()).catch(() => null);

            const [dataArikuchi, dataBagals] = await Promise.all([reqArikuchi, reqBagals]);

            let combinedData = { found: false, studentName: "", fatherName: "", enrolledCourses: [] };

            if (dataArikuchi && dataArikuchi.found) {
                combinedData.found = true;
                combinedData.studentName = dataArikuchi.studentName;
                combinedData.fatherName = dataArikuchi.fatherName;
                combinedData.enrolledCourses.push(...dataArikuchi.enrolledCourses);
            }

            if (dataBagals && dataBagals.found) {
                combinedData.found = true;
                combinedData.studentName = dataBagals.studentName;
                combinedData.fatherName = dataBagals.fatherName;

                dataBagals.enrolledCourses.forEach(courseObj => {
                    // Prevent pushing duplicate courses
                    if (!combinedData.enrolledCourses.find(c => c.courseName === courseObj.courseName)) {
                        combinedData.enrolledCourses.push(courseObj);
                    }
                });
            }

            return combinedData.found ? combinedData : null;

        } catch (error) {
            console.error("Verification failed", error);
            alert("Failed to securely verify your records.");
            return null;
        }
    }

    // 5. Initialize Page
    verifyEnrollment(userEmail).then(studentData => {
        stateLoading.classList.add('hidden');

        if (!studentData || studentData.enrolledCourses.length === 0) {
            document.getElementById('error-email-display').textContent = userEmail;
            stateUnregistered.classList.remove('hidden');
        } else {
            stateDeclaration.classList.remove('hidden');

            document.getElementById('ex-name').value = studentData.studentName;
            document.getElementById('ex-father').value = studentData.fatherName;

            globalEnrolledCourses = studentData.enrolledCourses; // Save to global variable

            studentData.enrolledCourses.forEach(courseData => {
                const opt = document.createElement('option');
                opt.value = courseData.courseName;
                opt.textContent = courseData.courseName;
                courseSelect.appendChild(opt);
            });
        }
    });

    // 6. Declaration Logic
    declarationCheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            btnContinue.disabled = false;
            btnContinue.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btnContinue.disabled = true;
            btnContinue.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });

    btnContinue.addEventListener('click', () => {
        stateDeclaration.classList.add('hidden');
        stateForm.classList.remove('hidden');
    });

    // 7. Course Selection Logic (Auto-fills Reg No, Branch, Duration, and Semester)
    courseSelect.addEventListener('change', function () {
        const selected = this.value;

        if (selected !== "") {
            this.classList.add('filled-input');

            // Find specific course data to fill Branch and RegNo
            const courseDetails = globalEnrolledCourses.find(c => c.courseName === selected);
            if (courseDetails) {
                branchInput.value = courseDetails.branch;
                regnoInput.value = courseDetails.regNo;
                branchInput.classList.add('filled-input');
                regnoInput.classList.add('filled-input');
            }
        } else {
            this.classList.remove('filled-input');
            branchInput.value = "";
            regnoInput.value = "";
            durationInput.value = "";
            branchInput.classList.remove('filled-input');
            regnoInput.classList.remove('filled-input');
            semesterWrapper.classList.add('hidden');
            semesterSelect.removeAttribute('required');
            return;
        }

        const duration = courseDurations[selected] || "Unknown";
        durationInput.value = duration;

        semesterSelect.innerHTML = '<option value="">-- Select Semester --</option>';
        semesterSelect.classList.remove('filled-input');

        const dLower = duration.toLowerCase();
        if (dLower.includes('3 month')) {
            semesterWrapper.classList.add('hidden');
            semesterSelect.removeAttribute('required');
        } else {
            semesterWrapper.classList.remove('hidden');
            semesterSelect.setAttribute('required', 'true');

            if (dLower.includes('6 month')) {
                semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option>';
            } else if (dLower.includes('1 year')) {
                semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option><option value="2nd Semester">2nd Semester</option>';
            } else if (dLower.includes('18 month')) {
                semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option><option value="2nd Semester">2nd Semester</option><option value="3rd Semester">3rd Semester</option>';
            } else if (dLower.includes('24 month')) {
                semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option><option value="2nd Semester">2nd Semester</option><option value="3rd Semester">3rd Semester</option><option value="4th Semester">4th Semester</option>';
            }
        }
    });

    semesterSelect.addEventListener('change', function () {
        if (this.value !== "") this.classList.add('filled-input');
        else this.classList.remove('filled-input');
    });

    // 8. Submit Form to New Google Sheet
    document.getElementById('exam-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnText = document.getElementById('apply-btn-text');
        const spinner = document.getElementById('apply-spinner');
        const applyBtn = document.getElementById('apply-btn');

        // UI Loading State
        btnText.classList.add('opacity-0'); // Hide text
        spinner.classList.remove('hidden');
        spinner.style.display = 'block';
        applyBtn.disabled = true;
        applyBtn.classList.add('cursor-wait');

        const payload = {
            email: userEmail,
            studentName: document.getElementById('ex-name').value,
            fatherName: document.getElementById('ex-father').value,
            branch: branchInput.value,
            regNo: regnoInput.value,
            course: courseSelect.value,
            duration: durationInput.value,
            semester: semesterSelect.value || "N/A"
        };

        try {
            // FIXED: Send data as plain text to bypass CORS preflight issues in Google Apps Script
            const response = await fetch(EXAM_API_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                // Omit headers entirely or use text/plain
            });

            const result = await response.json();

            if (result.status === 'success') {
                stateForm.classList.add('hidden');
                stateSuccess.classList.remove('hidden');
            } else {
                alert("Error submitting application: " + result.message);
                resetButton();
            }
        } catch (error) {
            console.error("Submit Error:", error);
            alert("Network error. Please try again.");
            resetButton();
        }

        function resetButton() {
            btnText.classList.remove('opacity-0');
            spinner.classList.add('hidden');
            spinner.style.display = 'none';
            applyBtn.disabled = false;
            applyBtn.classList.remove('cursor-wait');
        }
    });
});
