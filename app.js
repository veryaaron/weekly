/**
 * APP.JS
 * ======
 * 
 * Main application logic for Weekly Feedback Form
 */

// ========================================
// GLOBAL STATE
// ========================================

let currentUser = null;
let currentUserData = null;
let currentQuestion = 1;

const textareas = {};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Verify config loaded
    if (!window.FEEDBACK_CONFIG) {
        console.error('FEEDBACK_CONFIG not loaded!');
        document.getElementById('authError').innerHTML = `
            <div class="error-message">
                Configuration error. Please refresh the page.
            </div>
        `;
        return;
    }
    
    console.log('Config loaded successfully:', window.FEEDBACK_CONFIG.ALLOWED_DOMAINS);
    
    // Initialize textareas
    const fields = Object.keys(FEEDBACK_CONFIG.FORM_SETTINGS.QUESTIONS);
    fields.forEach(field => {
        textareas[field] = document.getElementById(field);
    });
    
    // Setup character counters
    setupCharacterCounters();
    
    // Setup form submission handler
    document.getElementById('feedbackForm').addEventListener('submit', handleFormSubmit);
    
    // Initialize Google Sign-In manually AFTER config is confirmed loaded
    initializeGoogleSignIn();
});

/**
 * Initialize Google Sign-In
 * Called after DOM and config are both loaded
 */
function initializeGoogleSignIn() {
    if (!window.google || !window.google.accounts) {
        console.error('Google Sign-In library not loaded');
        setTimeout(initializeGoogleSignIn, 100); // Retry after 100ms
        return;
    }
    
    const clientId = FEEDBACK_CONFIG.GOOGLE_CLIENT_ID;
    
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        document.getElementById('authError').innerHTML = `
            <div class="error-message">
                Google Client ID not configured. Please update config.js
            </div>
        `;
        return;
    }
    
    // Initialize Google Identity Services
    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false, // Disable auto-select to prevent race condition
        cancel_on_tap_outside: false
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
            logo_alignment: 'left'
        }
    );
    
    console.log('Google Sign-In initialized');
}

// ========================================
// GOOGLE OAUTH AUTHENTICATION
// ========================================

/**
 * Handle Google Sign-In response
 * Called automatically by Google Sign-In button
 */
function handleCredentialResponse(response) {
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
        givenName: payload.given_name
    };
    
    // Show form, hide auth
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('formCard').classList.add('active');
    
    // Populate user info
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userEmail').textContent = currentUserData.email;
    document.getElementById('userAvatar').src = currentUserData.picture;
    
    // Reset to first question
    currentQuestion = 1;
    updateProgress();
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
 */
function signOut() {
    google.accounts.id.disableAutoSelect();
    currentUser = null;
    currentUserData = null;
    document.getElementById('formCard').classList.remove('active');
    document.getElementById('authCard').style.display = 'block';
    document.getElementById('authError').innerHTML = '';
    document.getElementById('feedbackForm').reset();
    
    // Reset all suggestions
    const totalQuestions = FEEDBACK_CONFIG.FORM_SETTINGS.TOTAL_QUESTIONS;
    for (let i = 1; i <= totalQuestions; i++) {
        document.getElementById('aiSuggestion' + i).innerHTML = '';
    }
    
    // Reset to first question
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
    document.getElementById('question1').classList.add('active');
    currentQuestion = 1;
    updateProgress();
}

// ========================================
// MULTI-STEP FORM NAVIGATION
// ========================================

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
 */
function updateProgress() {
    const totalQuestions = FEEDBACK_CONFIG.FORM_SETTINGS.TOTAL_QUESTIONS;
    const progress = (currentQuestion / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
}

/**
 * Navigate to next question
 */
function nextQuestion(current) {
    // Validate current question
    const fields = Object.keys(FEEDBACK_CONFIG.FORM_SETTINGS.QUESTIONS);
    const field = fields[current - 1];
    const config = FEEDBACK_CONFIG.FORM_SETTINGS.QUESTIONS[field];
    const textarea = textareas[field];
    
    if (config.required && !textarea.value.trim()) {
        alert(FEEDBACK_CONFIG.ERRORS.missingAnswer);
        return;
    }

    // Hide current, show next
    document.getElementById('question' + current).classList.remove('active');
    currentQuestion = current + 1;
    document.getElementById('question' + currentQuestion).classList.add('active');
    updateProgress();
    window.scrollTo(0, 0);
}

/**
 * Navigate to previous question
 */
function prevQuestion(current) {
    document.getElementById('question' + current).classList.remove('active');
    currentQuestion = current - 1;
    document.getElementById('question' + currentQuestion).classList.add('active');
    updateProgress();
    window.scrollTo(0, 0);
}

// ========================================
// AI SUGGESTIONS
// ========================================

/**
 * Get AI suggestion for a specific question
 */
async function getAISuggestion(questionNum) {
    const btn = document.getElementById('aiBtn' + questionNum);
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> ' + FEEDBACK_CONFIG.TEXT.aiButtonLoading;

    const fields = Object.keys(FEEDBACK_CONFIG.FORM_SETTINGS.QUESTIONS);
    const field = fields[questionNum - 1];
    const response = textareas[field].value;

    if (response.trim().length < FEEDBACK_CONFIG.FORM_SETTINGS.MIN_CHARS_FOR_AI) {
        alert(FEEDBACK_CONFIG.ERRORS.aiMinChars);
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    try {
        const suggestion = await getClaudeSuggestion(field, response);
        displaySuggestion(questionNum, suggestion);
        btn.innerHTML = originalText;
        btn.disabled = false;
    } catch (error) {
        console.error('AI error:', error);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert(FEEDBACK_CONFIG.ERRORS.aiError);
    }
}

/**
 * Call Claude API for suggestion
 */
async function getClaudeSuggestion(field, response) {
    const prompts = {
        accomplishments: `The user wrote: "${response}"\n\nThis is for their weekly accomplishments. Provide 2-3 specific suggestions to make this more impactful: add metrics/data, explain the impact/outcome, or clarify what was achieved. Be constructive and encouraging.`,
        blockers: `The user wrote: "${response}"\n\nThis describes their blockers/challenges. Provide 2-3 specific suggestions: make the blocker more clear, specify what help they need, or explain the impact. Be supportive and solution-focused.`,
        morale: `The user wrote: "${response}"\n\nThis is about team morale. Provide 2-3 specific suggestions: add concrete examples, explain what's driving the energy (positive or negative), or clarify team sentiment. Be empathetic.`,
        ideas: `The user wrote: "${response}"\n\nThis is a bright idea. Provide 2-3 specific suggestions: elaborate on the potential impact, explain implementation approach, or clarify the opportunity. Be encouraging of innovation.`
    };

    const headers = {
        'Content-Type': 'application/json',
    };
    
    // Add API key if configured
    if (FEEDBACK_CONFIG.ANTHROPIC_API_KEY) {
        headers['x-api-key'] = FEEDBACK_CONFIG.ANTHROPIC_API_KEY;
    }

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: FEEDBACK_CONFIG.CLAUDE_MODEL,
            max_tokens: FEEDBACK_CONFIG.CLAUDE_MAX_TOKENS,
            messages: [{
                role: 'user',
                content: prompts[field]
            }]
        })
    });

    const data = await apiResponse.json();
    return data.content[0].text;
}

/**
 * Display AI suggestion in the UI
 */
function displaySuggestion(questionNum, suggestion) {
    const suggestionDiv = document.getElementById('aiSuggestion' + questionNum);
    suggestionDiv.innerHTML = `
        <div class="ai-suggestion">
            <div class="ai-suggestion-header">
                ${FEEDBACK_CONFIG.TEXT.aiSuggestionHeader}
            </div>
            <div class="ai-suggestion-content">
                ${suggestion}
            </div>
        </div>
    `;
}

// ========================================
// FORM SUBMISSION
// ========================================

/**
 * Handle form submission
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
    const formData = {
        timestamp: new Date().toISOString(),
        name: currentUserData.name,
        email: currentUserData.email
    };
    
    // Add all question responses
    Object.keys(FEEDBACK_CONFIG.FORM_SETTINGS.QUESTIONS).forEach(field => {
        formData[field] = textareas[field].value;
    });

    try {
        await submitToGoogleSheets(formData);
        
        // Hide form, show success
        const totalQuestions = FEEDBACK_CONFIG.FORM_SETTINGS.TOTAL_QUESTIONS;
        document.getElementById('question' + totalQuestions).classList.remove('active');
        document.getElementById('successScreen').style.display = 'block';
        document.getElementById('progressBar').style.width = '100%';

        // Auto logout after delay
        setTimeout(() => {
            signOut();
        }, FEEDBACK_CONFIG.FORM_SETTINGS.AUTO_LOGOUT_DELAY);
    } catch (error) {
        console.error('Submission error:', error);
        alert(FEEDBACK_CONFIG.ERRORS.submissionError);
        submitBtn.innerHTML = FEEDBACK_CONFIG.TEXT.submitButtonText;
        submitBtn.disabled = false;
    }
}

/**
 * Submit data to Google Sheets via Apps Script
 */
async function submitToGoogleSheets(data) {
    await fetch(FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    // Small delay to ensure submission completes
    await new Promise(resolve => setTimeout(resolve, 1000));
}

// ========================================
// EXPOSE FUNCTIONS GLOBALLY
// ========================================

// Functions called from HTML need to be on window object
window.handleCredentialResponse = handleCredentialResponse;
window.signOut = signOut;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.getAISuggestion = getAISuggestion;
