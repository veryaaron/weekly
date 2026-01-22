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
        document.getElementById('authError').innerHTML = `
            <div class="error-message">
                Questions not loaded. Please refresh the page.
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
        givenName: payload.given_name,
        firstName: payload.given_name || payload.name.split(' ')[0] // Extract first name
    };
    
    // Show form, hide auth
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('formCard').classList.add('active');
    
    // Populate user info
    document.getElementById('userName').textContent = currentUserData.name;
    document.getElementById('userEmail').textContent = currentUserData.email;
    document.getElementById('userAvatar').src = currentUserData.picture;
    
    // Set dynamic hint for accomplishments question
    const accomplishmentsHint = document.querySelector('#question1 .question-hint');
    if (accomplishmentsHint) {
        const question = QUESTIONS.DEFINITIONS.accomplishments;
        accomplishmentsHint.textContent = question.generateHint(currentUserData, answerCache);
    }
    
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
    for (let i = 1; i <= QUESTIONS.TOTAL; i++) {
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
    const totalQuestions = QUESTIONS.TOTAL;
    const progress = (currentQuestion / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
}

/**
 * Navigate to next question
 */
function nextQuestion(current) {
    // Validate current question
    const field = QUESTIONS.getFieldByIndex(current);
    const question = QUESTIONS.DEFINITIONS[field];
    const textarea = textareas[field];
    
    if (question.required && !textarea.value.trim()) {
        alert('Please provide an answer before continuing');
        return;
    }
    
    // Cache the answer before moving on
    cacheAnswer(field, textarea.value);
    
    console.log('Moving from question', current, 'to', current + 1);
    console.log('Current cache:', answerCache);

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
    // Cache current answer before going back
    const field = QUESTIONS.getFieldByIndex(current);
    cacheAnswer(field, textareas[field].value);
    
    document.getElementById('question' + current).classList.remove('active');
    currentQuestion = current - 1;
    document.getElementById('question' + currentQuestion).classList.add('active');
    
    // Restore cached answer for previous question
    const prevField = QUESTIONS.getFieldByIndex(currentQuestion);
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
// AI SUGGESTIONS
// ========================================

/**
 * Get AI suggestion for a specific question
 */
async function getAISuggestion(questionNum) {
    const btn = document.getElementById('aiBtn' + questionNum);
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Analyzing...';

    const field = QUESTIONS.getFieldByIndex(questionNum);
    const question = QUESTIONS.DEFINITIONS[field];
    const response = textareas[field].value;

    if (response.trim().length < QUESTIONS.MIN_CHARS_FOR_AI) {
        alert('Please write at least a sentence before asking for AI help');
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    try {
        const suggestion = await getClaudeSuggestion(question, response);
        displaySuggestion(questionNum, suggestion);
        btn.innerHTML = originalText;
        btn.disabled = false;
    } catch (error) {
        console.error('AI error:', error);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert('Could not get AI suggestions. Please continue with your response.');
    }
}

/**
 * Call Claude API for suggestion
 */
async function getClaudeSuggestion(question, response) {
    const prompt = question.aiPrompt(response);

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
                content: prompt
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
                🤖 Claude's Suggestions
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
    QUESTIONS.getOrder().forEach(field => {
        formData[field] = textareas[field].value;
    });

    try {
        await submitToGoogleSheets(formData);
        
        // Hide form, show success
        const totalQuestions = QUESTIONS.TOTAL;
        document.getElementById('question' + totalQuestions).classList.remove('active');
        document.getElementById('successScreen').style.display = 'block';
        document.getElementById('progressBar').style.width = '100%';

        // Auto logout after delay
        setTimeout(() => {
            signOut();
        }, FEEDBACK_CONFIG.FORM_SETTINGS.AUTO_LOGOUT_DELAY);
    } catch (error) {
        console.error('Submission error:', error);
        alert('Could not submit feedback. Please try again or contact your manager.');
        submitBtn.innerHTML = 'Submit Feedback ✓';
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

// Expose answer cache for use in dynamic question generation
window.getAnswerCache = () => answerCache;
window.getCachedAnswer = getCachedAnswer;
