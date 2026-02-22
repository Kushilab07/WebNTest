document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // 1. UI Elements
    const stateLoading = document.getElementById('state-loading');
    const stateUnregistered = document.getElementById('state-unregistered');
    const stateDeclaration = document.getElementById('state-declaration');
    const stateForm = document.getElementById('state-form');
    
    const declarationCheck = document.getElementById('fee-declaration');
    const btnContinue = document.getElementById('btn-continue');

    const courseSelect = document.getElementById('ex-course');
    const durationInput = document.getElementById('ex-duration');
    const semesterWrapper = document.getElementById('semester-wrapper');
    const semesterSelect = document.getElementById('ex-semester');

    // 2. Extract Email
    const urlParams = new URLSearchParams(window.location.search);
    const userEmail = urlParams.get('email');

    if (!userEmail) {
        // If someone directly opens the page without logging in
        alert("Session missing. Please login first.");
        window.location.href = 'index.html';
        return;
    }

    // 3. Database: Course to Duration Mapping (Matches registration logic)
    const courseDurations = {
        // 3 Months
        "Basic Of Computer": "3 Months", "Basics of Computer": "3 Months", "DTP": "3 Months", "Tally Prime & Accounting": "3 Months", "Advance Excel with MIS Report": "3 Months", "AI/ML using Python": "3 Months", "Digital Marketing": "3 Months", "Communication skill & Personality Dev": "3 Months", "Communication Skill & Personality Development": "3 Months", "Office management with Google workspace": "3 Months", "Office Management with Google workspace": "3 Months", "SDP(Skill Development Programme)": "3 Months",
        // 6 Months
        "Diploma in Computer Application": "6 Months", "Advance Tally Prime with GST": "6 Months", "Diploma in Computer Application in Business (CAB)": "6 Months", "Personal Financial Literacy & Stock Market": "6 Months", "Back office Management & MIS Report": "6 Months", "Data Analyst with Al Technology": "6 Months",
        // 1 Year
        "Advance Diploma in Computer Application": "1 Year", "Post Graduate Diploma in Computer Application": "1 Year", "Advance Diploma in Financial Accounting with Taxation": "1 Year",
        // Special
        "Advance Diploma in Computer Application with Al Technology": "18 Months",
        "Diploma in Computer Teacher Training": "18 Months",
        "Master Diploma in Computer Application": "24 Months"
    };

    // 4. API VERIFICATION (Simulated for now, replace with your Google Apps Script)
    async function verifyEnrollment(email) {
        try {
            // ==========================================
            // TODO: Call your Google Sheet checking URL here
            // Example: const response = await fetch(`YOUR_API_URL?email=${email}`);
            // const data = await response.json();
            // ==========================================

            // SIMULATION: Simulating a successful database fetch for demonstration
            // If you want to test the "Unregistered" state, change this to: return null;
            return {
                branch: "Arikuchi",
                studentName: "John Doe",
                fatherName: "Richard Doe",
                enrolledCourses: ["Diploma in Computer Application", "AI/ML using Python"] // Array of courses they registered for
            };
            
        } catch (error) {
            console.error("Verification failed", error);
            return null; 
        }
    }

    // 5. Initialize Page
    verifyEnrollment(userEmail).then(studentData => {
        // Hide loading
        stateLoading.classList.add('hidden');

        if (!studentData || !studentData.enrolledCourses || studentData.enrolledCourses.length === 0) {
            // Not registered state
            document.getElementById('error-email-display').textContent = userEmail;
            stateUnregistered.classList.remove('hidden');
        } else {
            // Registered! Show Declaration
            stateDeclaration.classList.remove('hidden');

            // Pre-fill the form data in the background
            document.getElementById('ex-branch').value = studentData.branch;
            document.getElementById('ex-name').value = studentData.studentName;
            document.getElementById('ex-father').value = studentData.fatherName;

            // Populate Course Dropdown with ONLY their enrolled courses
            studentData.enrolledCourses.forEach(course => {
                const opt = document.createElement('option');
                opt.value = course;
                opt.textContent = course;
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

    // 7. Course Selection & Semester Logic
    courseSelect.addEventListener('change', function() {
        const selected = this.value;
        
        // UX: Change background color if filled
        if (selected !== "") {
            this.classList.add('filled-input');
        } else {
            this.classList.remove('filled-input');
            durationInput.value = "";
            semesterWrapper.classList.add('hidden');
            semesterSelect.removeAttribute('required');
            return;
        }

        // Get duration
        const duration = courseDurations[selected] || "Unknown";
        durationInput.value = duration;

        // Reset Semester dropdown
        semesterSelect.innerHTML = '<option value="">-- Select Semester --</option>';
        semesterWrapper.classList.remove('hidden');
        semesterSelect.setAttribute('required', 'true');

        // Logic to build semester options
        const dLower = duration.toLowerCase();
        
        if (dLower.includes('3 month')) {
            // 3 Months = No semester required
            semesterWrapper.classList.add('hidden');
            semesterSelect.removeAttribute('required');
        } 
        else if (dLower.includes('6 month') || dLower.includes('1 year')) {
            // 6 Months or 1 Year = 1st & 2nd Semester
            semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option>';
            semesterSelect.innerHTML += '<option value="2nd Semester">2nd Semester</option>';
        }
        else if (dLower.includes('18 month')) {
            // 18 Months = 1st, 2nd, 3rd Semester
            semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option>';
            semesterSelect.innerHTML += '<option value="2nd Semester">2nd Semester</option>';
            semesterSelect.innerHTML += '<option value="3rd Semester">3rd Semester</option>';
        }
        else if (dLower.includes('24 month')) {
            // 24 Months = 1st, 2nd, 3rd, 4th Semester
            semesterSelect.innerHTML += '<option value="1st Semester">1st Semester</option>';
            semesterSelect.innerHTML += '<option value="2nd Semester">2nd Semester</option>';
            semesterSelect.innerHTML += '<option value="3rd Semester">3rd Semester</option>';
            semesterSelect.innerHTML += '<option value="4th Semester">4th Semester</option>';
        }
    });

    // Apply background color UX to Semester dropdown
    semesterSelect.addEventListener('change', function() {
        if(this.value !== "") this.classList.add('filled-input');
        else this.classList.remove('filled-input');
    });

    // 8. Submit Form
    document.getElementById('exam-form').addEventListener('submit', (e) => {
        e.preventDefault();
        alert("Exam Application Submitted Successfully!");
        // Add your Google Sheets POST logic here
    });
});