/**
 * APP.JS
 * ======
 *
 * Main application logic for Weekly Feedback Form
 *
 * v2.4 - Clean UX Redesign
 * - Simplified layout with single-focus design
 * - Admin tools moved to subtle header icon
 * - Sign out moved to bottom of card (not fixed footer)
 * - Cleaner visual hierarchy
 *
 * v2.3 - UX Refresh
 * - Enhanced progress bar with "Question X of Y" display
 * - Clickable header to reset/return to start
 * - Better mobile support
 *
 * v2.2 - Seamless Auto-Login for Returning Users
 * - Restored prompt() with auto_select: true for automatic sign-in
 * - Hybrid flow: auto-login attempt first, button fallback
 * - FedCM compliant with use_fedcm_for_prompt
 * - Returning Google Workspace users sign in without clicking
 *
 * v2.1 - Complete OAuth Overhaul
 * - Button-only flow (removed prompt() that caused extra step)
 * - Added use_fedcm_for_button for proper FedCM button support
 * - Changed to localStorage for cross-session persistence
 * - auto_select in button config for seamless returning user sign-in
 * - Profile picture with referrerpolicy and initials fallback
 *
 * v2.0 - Auto-Login UX Improvement
 * - Enabled auto_select for seamless returning user sign-in
 *
 * v1.9 - FedCM Migration & OAuth Cleanup
 * - Removed deprecated prompt notification methods (FedCM compliance)
 * - Fixed avatar 404 error when user has no picture
 *
 * v1.8 - Field Name Alignment & Bug Fixes
 * - Fixed field IDs to match HTML (accomplishments, blockers, priorities, aiFollowUp)
 */

// ========================================
// GLOBAL STATE
// ========================================

let currentUser = null;
let currentUserData = null;
let currentQuestion = 'accomplishments';  // v2.2: Now stores field name instead of number

const textareas = {};

// Cache for storing answers as user progresses
const answerCache = {};

// ========================================
// CACHE HELPER FUNCTIONS
// ========================================

/**
 * Cache an answer for a specific question
 */
function cacheAnswer(questionField, value) {
    answerCache[questionField] = value;
    console.log('Cached answer for:', questionField, '- Length:', value.length);
}

/**
 * Get cached answer for a specific question
 */
function getCachedAnswer(questionField) {
    return answerCache[questionField] || '';
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking dependencies...');
    console.log('window.FEEDBACK_CONFIG:', typeof window.FEEDBACK_CONFIG);
    console.log('window.QUESTIONS:', typeof window.QUESTIONS);

    // Verify config and questions loaded
    if (!window.FEEDBACK_CONFIG) {
        console.error('FEEDBACK_CONFIG not loaded!');
        document.getElementById('authError').innerHTML = `
            <div class="error-message">
                Configuration error. Please refresh the page.
            </div>
        `;
        return;
    }

    if (!window.QUESTIONS) {
        console.error('QUESTIONS not loaded!');
        console.error('Check if questions.js is accessible at: ' + window.location.origin + '/questions.js');
        document.getElementById('authError').innerHTML = `
            <div class="error-message">
                Questions not loaded. Please refresh the page.<br>
                <small>Check browser console (F12) for details.</small>
            </div>
        `;
        return;
    }

    console.log('Config loaded successfully:', window.FEEDBACK_CONFIG.ALLOWED_DOMAINS);
    console.log('Questions loaded:', QUESTIONS.getOrder());

    // Initialize textareas - map to actual HTML element IDs
    const fields = QUESTIONS.getOrder();
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            textareas[field] = element;
            console.log('Textarea found for:', field);
        } else {
            console.warn('Textarea NOT found for:', field);
        }
    });

    // Setup character counters
    setupCharacterCounters();

    // Setup form submission handler
    document.getElementById('feedbackForm').addEventListener('submit', handleFormSubmit);

    // Check for existing session before initializing Google Sign-In
    checkExistingSession();
});

/**
 * Check if user has an existing valid session
 * v2.1: Uses localStorage for persistence across browser sessions
 */
function checkExistingSession() {
    try {
        const savedSession = localStorage.getItem('feedbackUserSession');

        if (savedSession) {
            const session = JSON.parse(savedSession);
            const now = Date.now();

            // Session valid for 7 days (longer for localStorage)
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            if (session.timestamp && (now - session.timestamp) < SEVEN_DAYS) {
                console.log('Found valid session for:', session.email);

                // Restore user data
                currentUser = session.email;
                currentUserData = session.userData;

                // Show the form directly
                showFormForAuthenticatedUser();
                return;
            } else {
                console.log('Session expired, clearing...');
                localStorage.removeItem('feedbackUserSession');
            }
        }
    } catch (e) {
        console.log('No valid session found:', e);
    }

    // No valid session, initialize Google Sign-In
    initializeGoogleSignIn();
}

/**
 * Save session to localStorage
 * v2.1: Changed from sessionStorage for cross-session persistence
 */
function saveSession(email, userData) {
    try {
        localStorage.setItem('feedbackUserSession', JSON.stringify({
            email: email,
            userData: userData,
            timestamp: Date.now()
        }));
        console.log('Session saved for:', email);
    } catch (e) {
        console.log('Could not save session:', e);
    }
}

/**
 * Clear saved session
 */
function clearSession() {
    try {
        localStorage.removeItem('feedbackUserSession');
        console.log('Session cleared');
    } catch (e) {
        console.log('Could not clear session:', e);
    }
}

/**
 * Show form for already authenticated user
 * v2.4: Simplified for cleaner UI
 */
async function showFormForAuthenticatedUser() {
    // Hide loading
    const loadingEl = document.getElementById('signinLoading');
    if (loadingEl) loadingEl.style.display = 'none';

    // Show form, hide auth
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('formCard').style.display = 'block';

    // Check if user is admin and show admin toggle in header
    checkAndShowAdminPanel();

    // Populate hidden user info elements (for JS reference)
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userEmail').textContent = currentUserData.email;
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl && currentUserData.picture) {
        avatarEl.src = currentUserData.picture;
    }

    // Fetch previous week data for recall feature
    await fetchPreviousWeekData();

    // Set all dynamic hints
    updateQuestionHints();

    // Populate previous week summary if available
    populatePreviousWeekSummary();

    // Reset to first question
    currentQuestion = 'accomplishments';
    showQuestion('accomplishments');
    updateProgress();
}

/**
 * Fetch user's previous week submission for recall feature
 * v2.2: New function for previous week recall
 */
async function fetchPreviousWeekData() {
    console.log('Fetching previous week data for:', currentUserData.email);

    try {
        const scriptUrl = window.FEEDBACK_CONFIG?.GOOGLE_SCRIPT_URL;

        if (!scriptUrl) {
            console.log('Google Script URL not configured, skipping previous week fetch');
            currentUserData.previousWeek = null;
            return;
        }

        const response = await fetch(scriptUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'getPreviousWeek',
                email: currentUserData.email
            })
        });

        const data = await response.json();
        console.log('Previous week response:', data);

        if (data.status === 'success' && data.found) {
            currentUserData.previousWeek = {
                week: data.week,
                year: data.year,
                accomplishments: data.data.accomplishments,
                blockers: data.data.blockers,
                priorities: data.data.priorities,
                shoutouts: data.data.shoutouts || ''
            };
            console.log('Previous week data loaded:', currentUserData.previousWeek);
            // Navigation will include previousWeekProgress via getVisibleQuestionOrder()
        } else {
            currentUserData.previousWeek = null;
            console.log('No previous week data found');
            // Navigation will skip previousWeekProgress via getVisibleQuestionOrder()
        }

    } catch (error) {
        console.error('Error fetching previous week data:', error);
        currentUserData.previousWeek = null;
    }
}

/**
 * Initialize Google Sign-In with Hybrid Auto-Login Flow
 *
 * v2.2 CHANGE: Restored auto-login for returning users
 * - Uses prompt() with auto_select: true for seamless returning user sign-in
 * - Button fallback for new users or when auto-select is unavailable
 * - FedCM compliant for post-Aug 2025 requirements
 *
 * Flow:
 * 1. Initialize with auto_select: true
 * 2. Try prompt() - auto-signs in returning users without any click
 * 3. If prompt fails/skipped, button is available for manual sign-in
 *
 * References:
 * - https://developers.google.com/identity/gsi/web/guides/fedcm-migration
 * - https://developers.google.com/identity/gsi/web/guides/personalized-button
 */
function initializeGoogleSignIn() {
    console.log('Initializing Google Sign-In (hybrid auto-login flow)...');

    if (!window.google || !window.google.accounts) {
        console.log('Google Sign-In library not loaded yet, retrying...');
        setTimeout(initializeGoogleSignIn, 100);
        return;
    }

    const clientId = FEEDBACK_CONFIG.GOOGLE_CLIENT_ID;

    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        hideLoadingShowError('Google Client ID not configured. Please update config.js');
        return;
    }

    try {
        // Initialize Google Identity Services with auto_select enabled
        // auto_select: true - Automatically signs in returning users without prompt
        // This works when user has a single Google session and previously signed in
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: true,  // v2.2: Enable auto-login for returning users
            itp_support: true,  // Safari Intelligent Tracking Prevention support
            use_fedcm_for_prompt: true  // FedCM compliance for prompt flow
        });

        // Render the Sign In With Google button as fallback
        // Button is shown but auto_select may sign user in before they click
        google.accounts.id.renderButton(
            document.getElementById('g_id_signin'),
            {
                type: 'standard',
                size: 'large',
                theme: 'outline',
                text: 'sign_in_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 280,
                click_listener: () => console.log('Sign-in button clicked')
            }
        );

        // v2.2: Trigger prompt() for auto-login attempt
        // If user has a valid session, this will auto-sign them in
        // If not, the button is available for manual sign-in
        google.accounts.id.prompt((notification) => {
            if (notification.isDisplayed()) {
                console.log('One Tap prompt displayed');
            }
            if (notification.isNotDisplayed()) {
                console.log('One Tap not displayed:', notification.getNotDisplayedReason());
                // Button is available for manual sign-in
            }
            if (notification.isSkippedMoment()) {
                console.log('One Tap skipped:', notification.getSkippedReason());
            }
            if (notification.isDismissedMoment()) {
                console.log('One Tap dismissed:', notification.getDismissedReason());
            }
        });

        // Hide loading indicator after prompt attempt
        const loadingEl = document.getElementById('signinLoading');
        if (loadingEl) loadingEl.style.display = 'none';

        console.log('Google Sign-In initialized (hybrid auto-login flow)');

        // Show help button after 5 seconds in case user has issues
        setTimeout(() => {
            const helpEl = document.getElementById('authHelp');
            const authCard = document.getElementById('authCard');
            if (helpEl && authCard && authCard.style.display !== 'none') {
                helpEl.style.display = 'block';
            }
        }, 5000);

    } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        hideLoadingShowError('Error loading sign-in. Please refresh the page.');
    }
}

/**
 * Hide loading indicator and show error message
 */
function hideLoadingShowError(message) {
    const loadingEl = document.getElementById('signinLoading');
    if (loadingEl) loadingEl.style.display = 'none';

    const helpEl = document.getElementById('authHelp');
    if (helpEl) helpEl.style.display = 'block';

    document.getElementById('authError').innerHTML = `
        <div class="error-message">${message}</div>
    `;
}

// ========================================
// GOOGLE OAUTH AUTHENTICATION
// ========================================

/**
 * Handle Google Sign-In response
 * Called automatically by Google Sign-In button
 */
async function handleCredentialResponse(response) {
    const credential = response.credential;
    const payload = parseJwt(credential);

    console.log('Sign-in attempt:', payload.email);
    console.log('Config loaded:', !!window.FEEDBACK_CONFIG);
    console.log('Allowed domains:', window.FEEDBACK_CONFIG?.ALLOWED_DOMAINS);

    // Verify email domain
    const allowedDomains = window.FEEDBACK_CONFIG?.ALLOWED_DOMAINS;

    // If config not loaded yet, reject (shouldn't happen but safety check)
    if (!allowedDomains) {
        document.getElementById('authError').innerHTML = `
            <div class="error-message">
                ⛔ Configuration Error<br>
                Please refresh the page and try again.
            </div>
        `;
        console.error('FEEDBACK_CONFIG not loaded');
        return;
    }

    // If set to ANY_WORKSPACE, skip domain validation
    // (OAuth consent screen already restricts to Internal workspace users)
    if (allowedDomains !== 'ANY_WORKSPACE') {
        const emailDomain = payload.email.split('@')[1];
        const domains = Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains];
        const isAllowed = domains.some(domain => emailDomain === domain);

        console.log('Email domain:', emailDomain);
        console.log('Checking against:', domains);
        console.log('Is allowed:', isAllowed);

        if (!isAllowed) {
            document.getElementById('authError').innerHTML = `
                <div class="error-message">
                    ⛔ Access Denied<br>
                    You must sign in with an authorized domain.<br>
                    Allowed domains: ${domains.join(', ')}<br>
                    Your email: ${payload.email}
                </div>
            `;
            return;
        }
    }

    // Store user data
    currentUser = payload.email;
    currentUserData = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        givenName: payload.given_name,
        firstName: payload.given_name || payload.name.split(' ')[0] // Extract first name
    };

    // Save session for future visits
    saveSession(currentUser, currentUserData);

    // Show form, hide auth
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('formCard').style.display = 'block';

    // Populate user info (hidden elements for JS reference)
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userEmail').textContent = currentUserData.email;
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl && currentUserData.picture) {
        avatarEl.src = currentUserData.picture;
    }

    // Check if user is admin and show admin toggle
    checkAndShowAdminPanel();

    // Fetch previous week data for recall feature
    await fetchPreviousWeekData();

    // Set all dynamic hints
    updateQuestionHints();

    // Populate previous week summary if available
    populatePreviousWeekSummary();

    // Reset to first question
    currentQuestion = 'accomplishments';
    showQuestion('accomplishments');
    updateProgress();
}

/**
 * Populate the previous week summary display
 * v2.2: New function for previous week recall feature
 */
function populatePreviousWeekSummary() {
    const summaryEl = document.getElementById('previousWeekSummary');
    if (!summaryEl) return;

    if (currentUserData && currentUserData.previousWeek) {
        const prev = currentUserData.previousWeek;
        summaryEl.innerHTML = `
            <div class="previous-week-card">
                <h4>📅 Your Week ${prev.week} Summary</h4>
                <div class="previous-item">
                    <strong>Accomplishments:</strong>
                    <p>${escapeHtml(prev.accomplishments || 'None recorded')}</p>
                </div>
                <div class="previous-item">
                    <strong>Priorities:</strong>
                    <p>${escapeHtml(prev.priorities || 'None recorded')}</p>
                </div>
            </div>
        `;
    } else {
        summaryEl.innerHTML = '';
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update all question hints with dynamic content
 * v2.2: Updated for new question ID structure
 */
function updateQuestionHints() {
    // Update hints for all questions with generateHint functions
    const questionsToUpdate = ['accomplishments', 'previousWeekProgress', 'blockers', 'priorities', 'shoutouts'];

    questionsToUpdate.forEach((fieldName) => {
        // v2.2: Use new element ID format (hintAccomplishments, hintBlockers, etc.)
        const capitalizedField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        const hintElement = document.getElementById(`hint${capitalizedField}`);

        if (hintElement && QUESTIONS && QUESTIONS.DEFINITIONS) {
            const question = QUESTIONS.DEFINITIONS[fieldName];
            if (question && question.generateHint) {
                const hintText = question.generateHint(currentUserData, answerCache);
                hintElement.textContent = hintText;
                console.log(`Updated hint for ${fieldName}`);
            }
        }
    });
}

/**
 * Parse JWT token to extract user info
 */
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

/**
 * Sign out function
 * v2.2: Updated for new question ID structure
 */
function signOut() {
    google.accounts.id.disableAutoSelect();

    // Clear session storage
    clearSession();

    currentUser = null;
    currentUserData = null;

    // Hide form, show auth
    document.getElementById('formCard').style.display = 'none';
    document.getElementById('authCard').style.display = 'block';
    document.getElementById('authError').innerHTML = '';
    document.getElementById('feedbackForm').reset();

    // Hide admin toggle and panel
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) adminToggle.style.display = 'none';
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.classList.remove('open');

    // Clear answer cache
    Object.keys(answerCache).forEach(key => delete answerCache[key]);

    // Reset to first question
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
    document.getElementById('questionAccomplishments').classList.add('active');
    currentQuestion = 'accomplishments';
    updateProgress();

    // Hide success screen
    const successScreen = document.getElementById('successScreen');
    if (successScreen) successScreen.style.display = 'none';
}

// ========================================
// MULTI-STEP FORM NAVIGATION
// ========================================

/**
 * Get the visible question order based on user data
 * v2.2: Handles conditional questions like previousWeekProgress
 */
function getVisibleQuestionOrder() {
    const allQuestions = QUESTIONS.getOrder();

    return allQuestions.filter(fieldName => {
        // Skip previousWeekProgress if no previous week data
        if (fieldName === 'previousWeekProgress') {
            return currentUserData && currentUserData.previousWeek;
        }
        return true;
    });
}

/**
 * Get the next visible question after the current one
 */
function getNextQuestion(currentField) {
    const visibleOrder = getVisibleQuestionOrder();
    const currentIndex = visibleOrder.indexOf(currentField);

    if (currentIndex === -1 || currentIndex >= visibleOrder.length - 1) {
        return null;
    }

    return visibleOrder[currentIndex + 1];
}

/**
 * Get the previous visible question before the current one
 */
function getPreviousQuestion(currentField) {
    const visibleOrder = getVisibleQuestionOrder();
    const currentIndex = visibleOrder.indexOf(currentField);

    if (currentIndex <= 0) {
        return null;
    }

    return visibleOrder[currentIndex - 1];
}

/**
 * Get question element ID from field name
 */
function getQuestionElementId(fieldName) {
    // Convert fieldName to element ID (e.g., 'accomplishments' -> 'questionAccomplishments')
    const capitalizedField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    return 'question' + capitalizedField;
}

/**
 * Show a specific question by field name, hiding all others
 */
function showQuestion(fieldName) {
    // Hide all questions
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));

    // Show the target question
    const elementId = getQuestionElementId(fieldName);
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('active');
    }

    currentQuestion = fieldName;
}

/**
 * Setup character counters for all textareas
 */
function setupCharacterCounters() {
    Object.entries(textareas).forEach(([name, textarea]) => {
        const counter = document.getElementById(`${name}Count`);
        if (counter && textarea) {
            textarea.addEventListener('input', () => {
                counter.textContent = `${textarea.value.length} characters`;
            });
        }
    });
}

/**
 * Update progress bar based on current question
 * v2.3: Enhanced with question count display
 */
function updateProgress() {
    const visibleOrder = getVisibleQuestionOrder();
    const currentIndex = visibleOrder.indexOf(currentQuestion);
    const totalQuestions = visibleOrder.length;
    const currentNum = currentIndex + 1;

    // Update progress bar width
    const progress = (currentNum / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';

    // Update progress count text
    const progressCount = document.getElementById('progressCount');
    if (progressCount) {
        progressCount.textContent = `Question ${currentNum} of ${totalQuestions}`;
    }
}

/**
 * Reset form to start (called when clicking header)
 * v2.4: Fixed to work with display-based visibility
 */
function resetToStart() {
    const formCard = document.getElementById('formCard');
    const authCard = document.getElementById('authCard');

    // If on auth screen, go back to tools page
    if (authCard && authCard.style.display !== 'none') {
        window.location.href = '/';
        return;
    }

    // If form not visible, go to tools page
    if (!formCard || formCard.style.display === 'none') {
        window.location.href = '/';
        return;
    }

    // If on success screen, reload to start fresh
    const successScreen = document.getElementById('successScreen');
    if (successScreen && successScreen.style.display !== 'none') {
        window.location.href = '/weekly';
        return;
    }

    // Reset to first question
    showQuestion('accomplishments');
    updateProgress();
    window.scrollTo(0, 0);
}

/**
 * Navigate to next question
 * v2.2: Now uses field names instead of numbers, handles conditional questions
 */
async function nextQuestion(currentField) {
    // Validate current question
    const question = QUESTIONS.DEFINITIONS[currentField];
    const textarea = textareas[currentField];

    if (!textarea) {
        console.error('Textarea not found for field:', currentField);
        return;
    }

    if (question && question.required && !textarea.value.trim()) {
        alert('Please provide an answer before continuing');
        return;
    }

    // Cache the answer before moving on
    cacheAnswer(currentField, textarea.value);

    const nextField = getNextQuestion(currentField);
    console.log('Moving from', currentField, 'to', nextField);
    console.log('Current cache:', answerCache);

    if (!nextField) {
        console.error('No next question found');
        return;
    }

    // If moving from shoutouts, generate AI summary and follow-up
    if (currentField === 'shoutouts') {
        const generateBtn = document.getElementById('generateAIBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="loading"></span> Analyzing your answers...';
        }

        console.log('Starting AI generation...');
        console.log('Cached answers:', answerCache);

        try {
            // Generate AI summary and follow-up question
            console.log('Calling generateAIFollowUpQuestion...');
            const aiResponse = await window.generateAIFollowUpQuestion(currentUserData, answerCache);
            console.log('AI Response received:', aiResponse);

            // Store both summary and question
            answerCache.aiSummary = aiResponse.summary;
            answerCache.aiQuestion = aiResponse.question;

            // Update AI follow-up hint with the AI-generated question
            const hintElement = document.getElementById('aiQuestionHint');
            if (hintElement) {
                hintElement.textContent = aiResponse.question;
                console.log('Updated hint element with AI question');
            } else {
                console.error('Could not find aiQuestionHint element');
            }

            if (generateBtn) {
                generateBtn.innerHTML = 'Generate Follow-up Question →';
                generateBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error generating AI question:', error);
            console.error('Error details:', error.message, error.stack);
            const firstName = currentUserData.firstName || currentUserData.name.split(' ')[0];
            const fallbackQuestion = `Is there anything else important you'd like to discuss, ${firstName}?`;

            const hintElement = document.getElementById('aiQuestionHint');
            if (hintElement) {
                hintElement.textContent = fallbackQuestion;
            }

            answerCache.aiSummary = 'Thank you for your updates.';
            answerCache.aiQuestion = fallbackQuestion;

            if (generateBtn) {
                generateBtn.innerHTML = 'Generate Follow-up Question →';
                generateBtn.disabled = false;
            }
        }
    }

    // Hide current, show next
    const currentElementId = getQuestionElementId(currentField);
    const nextElementId = getQuestionElementId(nextField);

    document.getElementById(currentElementId).classList.remove('active');
    document.getElementById(nextElementId).classList.add('active');

    currentQuestion = nextField;

    // Update hints for dynamic questions
    updateQuestionHints();

    updateProgress();
    window.scrollTo(0, 0);
}

/**
 * Navigate to previous question
 * v2.2: Now uses field names instead of numbers
 */
function prevQuestion(currentField) {
    // Cache current answer before going back
    if (textareas[currentField]) {
        cacheAnswer(currentField, textareas[currentField].value);
    }

    const prevField = getPreviousQuestion(currentField);

    if (!prevField) {
        console.error('No previous question found');
        return;
    }

    const currentElementId = getQuestionElementId(currentField);
    const prevElementId = getQuestionElementId(prevField);

    document.getElementById(currentElementId).classList.remove('active');
    document.getElementById(prevElementId).classList.add('active');

    currentQuestion = prevField;

    // Restore cached answer for previous question
    const cachedValue = getCachedAnswer(prevField);
    if (cachedValue && textareas[prevField]) {
        textareas[prevField].value = cachedValue;
        // Update character count
        const counter = document.getElementById(`${prevField}Count`);
        if (counter) {
            counter.textContent = `${cachedValue.length} characters`;
        }
    }

    updateProgress();
    window.scrollTo(0, 0);
}

// ========================================
// FORM SUBMISSION
// ========================================

/**
 * Handle form submission
 * v2.2: Updated to include new fields (previousWeekProgress, shoutouts)
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        alert(FEEDBACK_CONFIG.ERRORS.notSignedIn);
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> ' + FEEDBACK_CONFIG.TEXT.submitButtonLoading;

    // Collect form data
    // v2.2: Added previousWeekProgress and shoutouts
    const formData = {
        action: 'submit', // Tell Apps Script this is a submission
        timestamp: new Date().toISOString(),
        name: currentUserData.name,
        email: currentUserData.email,
        // Main answers
        accomplishments: answerCache.accomplishments || textareas.accomplishments?.value || '',
        previousWeekProgress: answerCache.previousWeekProgress || textareas.previousWeekProgress?.value || '',
        blockers: answerCache.blockers || textareas.blockers?.value || '',
        priorities: answerCache.priorities || textareas.priorities?.value || '',
        shoutouts: answerCache.shoutouts || textareas.shoutouts?.value || '',
        // AI-generated summary and question
        aiSummary: answerCache.aiSummary || '',
        aiQuestion: answerCache.aiQuestion || '',
        // Answer to the AI-generated question
        aiAnswer: textareas.aiFollowUp?.value || ''
    };

    console.log('Submitting form data:', formData);

    try {
        console.log('Calling submitToGoogleSheets...');
        await submitToGoogleSheets(formData);
        console.log('Submission successful!');

        // Hide form, show success (v2.2: use new element ID)
        document.getElementById('questionAiFollowUp').classList.remove('active');
        document.getElementById('successScreen').style.display = 'block';
        document.getElementById('progressBar').style.width = '100%';

        // Auto logout after delay
        setTimeout(() => {
            signOut();
        }, FEEDBACK_CONFIG.FORM_SETTINGS.AUTO_LOGOUT_DELAY);
    } catch (error) {
        console.error('Submission error:', error);
        console.error('Error details:', error.message, error.stack);
        alert('Could not submit feedback. Please try again or contact your manager.\n\nError: ' + error.message);
        submitBtn.innerHTML = 'Submit Feedback ✓';
        submitBtn.disabled = false;
    }
}

/**
 * Submit data to Google Sheets via Apps Script
 */
async function submitToGoogleSheets(data) {
    console.log('Submitting to:', FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL);
    console.log('Data being sent:', data);

    try {
        // Google Apps Script redirects, so we need to follow redirects
        const response = await fetch(FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain', // Use text/plain to avoid CORS preflight
            },
            body: JSON.stringify(data)
        });

        console.log('Response status:', response.status);
        console.log('Response type:', response.type);

        // Try to read response, but don't fail if we can't
        try {
            const result = await response.json();
            console.log('Response data:', result);

            if (result.status === 'error') {
                throw new Error(result.message || 'Submission failed');
            }
        } catch (parseError) {
            // If we can't parse response, assume success if status is ok
            console.log('Could not parse response, but request completed');
        }

        console.log('Submission successful!');

    } catch (error) {
        console.error('Fetch error:', error);
        throw new Error('Submission error: ' + error.message);
    }
}

// ========================================
// ADMIN FUNCTIONS
// ========================================

/**
 * Check if current user is an admin and show admin toggle
 * v2.4: Now shows toggle button in header instead of card
 */
function checkAndShowAdminPanel() {
    const adminEmails = FEEDBACK_CONFIG.ADMIN_EMAILS || [];
    const userEmail = currentUserData?.email?.toLowerCase();

    if (!userEmail) return;

    const isAdmin = adminEmails.some(email => email.toLowerCase() === userEmail);

    // Show/hide admin toggle button in header
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
        adminToggle.style.display = isAdmin ? 'flex' : 'none';
    }

    console.log('Admin check:', userEmail, isAdmin ? '(admin)' : '(not admin)');
}

/**
 * Toggle the admin panel open/closed
 * v2.4: New function for slide-down admin panel
 */
function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    const toggle = document.getElementById('adminToggle');

    if (panel && toggle) {
        panel.classList.toggle('open');
        toggle.classList.toggle('active');
    }
}

/**
 * Generate weekly report (called from admin panel)
 * v2.0: Added event prevention to stop any page navigation
 */
async function generateReport(event) {
    // Prevent any default behavior that might cause page reload
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const btn = document.getElementById('generateReportBtn');
    const statusEl = document.getElementById('reportStatus');

    // Disable button and show loading
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Generating...';
    statusEl.className = 'loading';
    statusEl.innerHTML = 'Generating report, please wait...';

    try {
        const scriptUrl = FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL;

        const response = await fetch(scriptUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'generateReport',
                requestedBy: currentUserData.email
            })
        });

        const text = await response.text();
        console.log('Raw response text:', text);
        let result;

        try {
            result = JSON.parse(text);
            console.log('Parsed result:', result);
            console.log('docUrl value:', result.docUrl);
        } catch (e) {
            console.error('JSON parse error:', e, 'Raw text was:', text);
            throw new Error('Invalid response from server');
        }

        if (result.status === 'success') {
            statusEl.className = 'success';
            const reportUrl = result.docUrl || result.reportUrl || result.url;
            console.log('Using URL:', reportUrl);
            statusEl.innerHTML = `✓ Report generated! <a href="${reportUrl}" target="_blank">Open Report →</a>`;
        } else if (result.status === 'no_responses') {
            statusEl.className = 'error';
            statusEl.innerHTML = '⚠️ No responses found for this week yet.';
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('Report generation error:', error);
        statusEl.className = 'error';
        statusEl.innerHTML = '❌ Error generating report: ' + error.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generate Report';
    }
}

// ========================================
// EXPOSE FUNCTIONS GLOBALLY
// ========================================

// Functions called from HTML need to be on window object
window.handleCredentialResponse = handleCredentialResponse;
window.signOut = signOut;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.generateReport = generateReport;
window.resetToStart = resetToStart;
window.toggleAdminPanel = toggleAdminPanel;

// Expose answer cache for use in dynamic question generation
window.getAnswerCache = () => answerCache;
window.getCachedAnswer = getCachedAnswer;
