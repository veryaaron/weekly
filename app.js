/**
 * Weekly Feedback Form - Main Application
 * Version 1.6 - FedCM Authentication
 * 
 * Changelog v1.6:
 * - Enabled FedCM (Federated Credential Management) for modern auth
 * - Fixed mobile caching issues causing blank pages
 * - Added disableAutoSelect() to clear stale GSI state
 * - Changed ux_mode to 'popup' for better mobile handling
 */

// ========================================
// GLOBAL STATE
// ========================================

let currentUser = '';
let currentUserData = null;
let currentQuestion = 1;
const textareas = {};
const answerCache = {};

// Session duration in milliseconds (1 hour)
const SESSION_DURATION = 60 * 60 * 1000;

// ========================================
// SESSION MANAGEMENT
// ========================================

/**
 * Check for existing valid session
 */
function checkExistingSession() {
    try {
        const savedSession = sessionStorage.getItem('feedbackUserSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            const age = Date.now() - session.timestamp;
            
            if (age < SESSION_DURATION && session.email && session.userData) {
                console.log('Valid session found for:', session.email);
                
                // Restore user data
                currentUser = session.email;
                currentUserData = session.userData;
                
                // Show the form directly
                showFormForAuthenticatedUser();
                return true;
            } else {
                console.log('Session expired, clearing...');
                sessionStorage.removeItem('feedbackUserSession');
            }
        }
    } catch (e) {
        console.log('No valid session found:', e);
    }
    return false;
}

/**
 * Save session to sessionStorage
 */
function saveSession(email, userData) {
    try {
        sessionStorage.setItem('feedbackUserSession', JSON.stringify({
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
        sessionStorage.removeItem('feedbackUserSession');
        console.log('Session cleared');
    } catch (e) {
        console.log('Could not clear session:', e);
    }
}

// ========================================
// GOOGLE SIGN-IN WITH FEDCM
// ========================================

/**
 * Initialize Google Sign-In with FedCM
 * 
 * FedCM (Federated Credential Management) is the modern browser API for authentication.
 * It handles credential caching at the browser level, eliminating conflicts with
 * Google's own caching mechanisms that cause blank pages on mobile.
 */
function initializeGoogleSignIn() {
    console.log('Initializing Google Sign-In with FedCM...');
    
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
        // Clear any stale Google auth state before initializing
        // This prevents conflicts with cached OAuth state that causes blank pages
        google.accounts.id.disableAutoSelect();
        
        // Initialize Google Identity Services with FedCM enabled
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,           // Disable auto-select - let FedCM handle it
            cancel_on_tap_outside: false,
            itp_support: true,            // Safari/iOS Intelligent Tracking Prevention
            use_fedcm_for_prompt: true,   // Enable FedCM for modern credential management
            context: 'signin',            // Hint to browser about the auth context
            ux_mode: 'popup'              // Use popup mode for better mobile handling
        });
        
        // Render the sign-in button
        google.accounts.id.renderButton(
            document.getElementById('g_id_signin'),
            {
                type: 'standard',
                size: 'large',
                theme: 'outline',
                text: 'sign_in_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 280
            }
        );
        
        // Hide loading indicator
        const loadingEl = document.getElementById('signinLoading');
        if (loadingEl) loadingEl.style.display = 'none';
        
        // Prompt for FedCM credential selection
        // This uses the browser's native credential UI instead of Google's redirect
        google.accounts.id.prompt((notification) => {
            console.log('FedCM prompt notification:', notification);
            
            if (notification.isNotDisplayed()) {
                const reason = notification.getNotDisplayedReason();
                console.log('FedCM not displayed. Reason:', reason);
                
                // If FedCM isn't supported, the button will still work
                // Common reasons: browser_not_supported, invalid_client, opt_out_or_no_session
                if (reason === 'browser_not_supported') {
                    console.log('FedCM not supported in this browser - using button sign-in');
                }
            } else if (notification.isSkippedMoment()) {
                console.log('FedCM skipped. Reason:', notification.getSkippedReason());
            } else if (notification.isDismissedMoment()) {
                console.log('FedCM dismissed. Reason:', notification.getDismissedReason());
            }
        });
        
        console.log('Google Sign-In initialized successfully with FedCM');
        
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
        hideLoadingShowError(`Error loading sign-in. Please refresh the page.<br><small>${error.message}</small>`);
    }
}

/**
 * Helper to show error and hide loading state
 */
function hideLoadingShowError(message) {
    const loadingEl = document.getElementById('signinLoading');
    if (loadingEl) loadingEl.style.display = 'none';
    
    document.getElementById('authError').innerHTML = `
        <div class="error-message">${message}</div>
    `;
    
    const helpEl = document.getElementById('authHelp');
    if (helpEl) helpEl.style.display = 'block';
}

/**
 * Handle credential response from Google Sign-In
 */
function handleCredentialResponse(response) {
    console.log('Credential response received');
    
    // Decode the JWT token
    const payload = parseJwt(response.credential);
    console.log('User:', payload.email);
    
    // Verify email domain
    const allowedDomains = FEEDBACK_CONFIG.ALLOWED_DOMAINS;
    
    // If set to ANY_WORKSPACE, skip domain validation
    // (OAuth consent screen already restricts to Internal workspace users)
    if (allowedDomains !== 'ANY_WORKSPACE') {
        const emailDomain = payload.email.split('@')[1];
        const domains = Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains];
        const isAllowed = domains.some(domain => emailDomain === domain);
        
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
        name: payload.name,
        email: payload.email,
        picture: payload.picture
    };
    
    // Save session for persistence
    saveSession(currentUser, currentUserData);
    
    // Hide auth card, show form
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('formCard').classList.add('active');
    
    // Show sign-out button
    const signoutContainer = document.getElementById('signoutContainer');
    if (signoutContainer) signoutContainer.classList.add('active');
    
    // Check if user is admin and show admin panel
    checkAndShowAdminPanel();
    
    // Populate user info (hidden elements for JS reference)
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userEmail').textContent = currentUserData.email;
    document.getElementById('userAvatar').src = currentUserData.picture || '';
    
    // Set all dynamic hints
    updateQuestionHints();
    
    // Reset to first question
    currentQuestion = 1;
    updateProgress();
}

/**
 * Show form for already authenticated user (from session)
 */
function showFormForAuthenticatedUser() {
    // Hide loading
    const loadingEl = document.getElementById('signinLoading');
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Show form, hide auth
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('formCard').classList.add('active');
    
    // Show sign-out button
    const signoutContainer = document.getElementById('signoutContainer');
    if (signoutContainer) signoutContainer.classList.add('active');
    
    // Check if user is admin and show admin panel
    checkAndShowAdminPanel();
    
    // Populate user info
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userEmail').textContent = currentUserData.email;
    document.getElementById('userAvatar').src = currentUserData.picture || '';
    
    // Set all dynamic hints
    updateQuestionHints();
    
    // Reset to first question
    currentQuestion = 1;
    updateProgress();
}

/**
 * Parse JWT token
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
 * Sign out user
 */
function signOut() {
    console.log('Signing out...');
    
    // Clear session
    clearSession();
    
    // Reset state
    currentUser = '';
    currentUserData = null;
    
    // Clear form
    document.getElementById('feedbackForm').reset();
    
    // Clear answer cache
    Object.keys(answerCache).forEach(key => delete answerCache[key]);
    
    // Reset to first question
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
    document.getElementById('question1').classList.add('active');
    currentQuestion = 1;
    
    // Hide form, show auth
    document.getElementById('formCard').classList.remove('active');
    document.getElementById('authCard').style.display = 'block';
    
    // Hide admin panel
    const adminCard = document.getElementById('adminCard');
    if (adminCard) adminCard.style.display = 'none';
    
    // Hide sign-out button
    const signoutContainer = document.getElementById('signoutContainer');
    if (signoutContainer) signoutContainer.classList.remove('active');
    
    // Revoke Google credential
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    
    // Re-initialize sign-in
    initializeGoogleSignIn();
}

// ========================================
// ADMIN FUNCTIONS
// ========================================

/**
 * Check if current user is an admin and show admin panel
 */
function checkAndShowAdminPanel() {
    const adminEmails = FEEDBACK_CONFIG.ADMIN_EMAILS || [];
    const userEmail = currentUserData?.email?.toLowerCase();
    
    if (!userEmail) return;
    
    const isAdmin = adminEmails.some(email => email.toLowerCase() === userEmail);
    
    const adminCard = document.getElementById('adminCard');
    if (adminCard) {
        adminCard.style.display = isAdmin ? 'block' : 'none';
    }
    
    console.log('Admin check:', userEmail, isAdmin ? '✓ Admin' : '✗ Not admin');
}

/**
 * Generate weekly report (admin function)
 */
async function generateReport() {
    const btn = document.getElementById('generateReportBtn');
    const statusDiv = document.getElementById('reportStatus');
    
    // Show loading state
    btn.disabled = true;
    btn.textContent = 'Generating...';
    statusDiv.innerHTML = '<p class="status-loading">⏳ Creating report with Claude AI analysis...</p>';
    
    try {
        const response = await fetch(FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'generateReport',
                requestedBy: currentUserData?.email || 'unknown'
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success' && result.reportUrl) {
            statusDiv.innerHTML = `
                <p class="status-success">
                    ✓ Report generated!
                    <a href="${result.reportUrl}" target="_blank" class="report-link">Open Report →</a>
                </p>
            `;
        } else {
            throw new Error(result.message || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Report generation error:', error);
        statusDiv.innerHTML = `
            <p class="status-error">
                ✗ Error: ${error.message}<br>
                <small>Please try again or check the console for details.</small>
            </p>
        `;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Weekly Report';
    }
}

// ========================================
// FORM NAVIGATION
// ========================================

/**
 * Update question hints with dynamic content
 */
function updateQuestionHints() {
    const fields = QUESTIONS.getOrder();
    fields.forEach(field => {
        const config = QUESTIONS.get(field);
        if (config && config.hint) {
            const hintEl = document.querySelector(`#question${fields.indexOf(field) + 1} .hint`);
            if (hintEl) {
                // Replace {name} placeholder with user's first name
                const firstName = currentUserData?.name?.split(' ')[0] || 'there';
                hintEl.textContent = config.hint.replace('{name}', firstName);
            }
        }
    });
}

/**
 * Update progress indicator
 */
function updateProgress() {
    const totalQuestions = QUESTIONS.getOrder().length;
    const progressEl = document.getElementById('progressIndicator');
    if (progressEl) {
        progressEl.textContent = `Question ${currentQuestion} of ${totalQuestions}`;
    }
    
    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        const percent = (currentQuestion / totalQuestions) * 100;
        progressBar.style.width = `${percent}%`;
    }
}

/**
 * Navigate to next question
 */
function nextQuestion() {
    const fields = QUESTIONS.getOrder();
    const currentField = fields[currentQuestion - 1];
    const textarea = textareas[currentField];
    
    // Validate current answer
    if (!textarea || !textarea.value.trim()) {
        showError(FEEDBACK_CONFIG.ERRORS.missingAnswer);
        return;
    }
    
    // Cache the answer
    answerCache[currentField] = textarea.value.trim();
    
    // Move to next question
    if (currentQuestion < fields.length) {
        document.getElementById(`question${currentQuestion}`).classList.remove('active');
        currentQuestion++;
        document.getElementById(`question${currentQuestion}`).classList.add('active');
        updateProgress();
        
        // Focus the textarea
        const nextField = fields[currentQuestion - 1];
        if (textareas[nextField]) {
            textareas[nextField].focus();
        }
    }
}

/**
 * Navigate to previous question
 */
function prevQuestion() {
    if (currentQuestion > 1) {
        // Cache current answer before moving
        const fields = QUESTIONS.getOrder();
        const currentField = fields[currentQuestion - 1];
        if (textareas[currentField] && textareas[currentField].value.trim()) {
            answerCache[currentField] = textareas[currentField].value.trim();
        }
        
        document.getElementById(`question${currentQuestion}`).classList.remove('active');
        currentQuestion--;
        document.getElementById(`question${currentQuestion}`).classList.add('active');
        updateProgress();
        
        // Focus the textarea
        const prevField = fields[currentQuestion - 1];
        if (textareas[prevField]) {
            textareas[prevField].focus();
        }
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// ========================================
// CHARACTER COUNTERS
// ========================================

/**
 * Setup character counters for all textareas
 */
function setupCharacterCounters() {
    const fields = QUESTIONS.getOrder();
    fields.forEach(field => {
        const textarea = textareas[field];
        const config = QUESTIONS.get(field);
        
        if (textarea && config && config.maxLength) {
            textarea.addEventListener('input', () => {
                updateCharacterCount(field, config.maxLength);
            });
            // Initial count
            updateCharacterCount(field, config.maxLength);
        }
    });
}

/**
 * Update character count display
 */
function updateCharacterCount(field, maxLength) {
    const textarea = textareas[field];
    const countEl = document.getElementById(`${field}Count`);
    
    if (textarea && countEl) {
        const remaining = maxLength - textarea.value.length;
        countEl.textContent = `${remaining} characters remaining`;
        
        if (remaining < 50) {
            countEl.classList.add('warning');
        } else {
            countEl.classList.remove('warning');
        }
    }
}

// ========================================
// AI SUGGESTIONS
// ========================================

/**
 * Get AI suggestions for current answer
 */
async function getAISuggestion(field) {
    const textarea = textareas[field];
    const config = QUESTIONS.get(field);
    
    if (!textarea || textarea.value.length < 20) {
        showError(FEEDBACK_CONFIG.ERRORS.aiMinChars);
        return;
    }
    
    const btn = document.querySelector(`#question${QUESTIONS.getOrder().indexOf(field) + 1} .btn-ai`);
    const suggestionDiv = document.querySelector(`#question${QUESTIONS.getOrder().indexOf(field) + 1} .ai-suggestion`);
    
    // Show loading state
    if (btn) {
        btn.disabled = true;
        btn.textContent = FEEDBACK_CONFIG.TEXT.aiButtonLoading;
    }
    
    try {
        const prompt = `You are helping someone write better feedback for their weekly team update. 
        
The question they're answering is: "${config.question}"

Their current answer is:
"${textarea.value}"

Please provide 2-3 brief, specific suggestions to make their answer more impactful, clear, or actionable. Keep suggestions concise and friendly. Focus on substance, not grammar.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': FEEDBACK_CONFIG.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: FEEDBACK_CONFIG.CLAUDE_MODEL,
                max_tokens: FEEDBACK_CONFIG.CLAUDE_MAX_TOKENS,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        const suggestion = data.content[0].text;
        
        if (suggestionDiv) {
            suggestionDiv.innerHTML = `
                <h4>${FEEDBACK_CONFIG.TEXT.aiSuggestionHeader}</h4>
                <p>${suggestion.replace(/\n/g, '<br>')}</p>
            `;
            suggestionDiv.style.display = 'block';
        }
        
    } catch (error) {
        console.error('AI suggestion error:', error);
        if (suggestionDiv) {
            suggestionDiv.innerHTML = `<p class="error">${FEEDBACK_CONFIG.ERRORS.aiError}</p>`;
            suggestionDiv.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = FEEDBACK_CONFIG.TEXT.aiButtonText;
        }
    }
}

// ========================================
// FORM SUBMISSION
// ========================================

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = FEEDBACK_CONFIG.TEXT.submitButtonLoading;
    
    try {
        // Gather all answers
        const fields = QUESTIONS.getOrder();
        const formData = {
            timestamp: new Date().toISOString(),
            email: currentUser,
            name: currentUserData?.name || ''
        };
        
        fields.forEach(field => {
            formData[field] = textareas[field]?.value.trim() || answerCache[field] || '';
        });
        
        // Submit to Google Apps Script
        await submitToGoogleSheets(formData);
        
        // Show success screen
        document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
        document.getElementById('successScreen').style.display = 'block';
        
        // Auto sign-out after delay
        setTimeout(() => {
            signOut();
        }, FEEDBACK_CONFIG.FORM_SETTINGS.AUTO_LOGOUT_DELAY);
        
    } catch (error) {
        console.error('Submission error:', error);
        showError(FEEDBACK_CONFIG.ERRORS.submissionError);
        submitBtn.disabled = false;
        submitBtn.textContent = FEEDBACK_CONFIG.TEXT.submitButtonText;
    }
}

/**
 * Submit form data to Google Sheets via Apps Script
 */
async function submitToGoogleSheets(data) {
    try {
        const response = await fetch(FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'submitFeedback',
                data: data
            })
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Submission failed');
        }
        
        console.log('Submission successful!');
        
    } catch (error) {
        console.error('Fetch error:', error);
        throw new Error('Submission error: ' + error.message);
    }
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
    
    // Initialize textareas
    const fields = QUESTIONS.getOrder();
    fields.forEach(field => {
        textareas[field] = document.getElementById(field);
    });
    
    // Setup character counters
    setupCharacterCounters();
    
    // Setup form submission handler
    document.getElementById('feedbackForm').addEventListener('submit', handleFormSubmit);
    
    // Check for existing session first
    const hasSession = checkExistingSession();
    
    // If no valid session, initialize Google Sign-In
    if (!hasSession) {
        initializeGoogleSignIn();
    }
});

// Make functions available globally for onclick handlers
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.signOut = signOut;
window.getAISuggestion = getAISuggestion;
window.generateReport = generateReport;
