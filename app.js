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
    
    // Initialize Google Sign-In manually AFTER config is confirmed loaded
    initializeGoogleSignIn();
});

/**
 * Initialize Google Sign-In
 * Called after DOM and config are both loaded
 */
function initializeGoogleSignIn() {
    console.log('Initializing Google Sign-In...');
    
    if (!window.google || !window.google.accounts) {
        console.log('Google Sign-In library not loaded yet, retrying...');
        setTimeout(initializeGoogleSignIn, 100); // Retry after 100ms
        return;
    }
    
    const clientId = FEEDBACK_CONFIG.GOOGLE_CLIENT_ID;
    
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        hideLoadingShowError('Google Client ID not configured. Please update config.js');
        return;
    }
    
    try {
        // Initialize Google Identity Services
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false, // Disable auto-select to prevent issues
            cancel_on_tap_outside: false,
            itp_support: true // Intelligent Tracking Prevention support for Safari/iOS
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
        
        console.log('Google Sign-In initialized successfully');
        
        // Show help button after 5 seconds in case user has issues
        setTimeout(() => {
            const helpEl = document.getElementById('authHelp');
            const authCard = document.getElementById('authCard');
            // Only show if still on auth screen
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
    
    // Set all dynamic hints
    updateQuestionHints();
    
    // Reset to first question
    currentQuestion = 1;
    updateProgress();
}

/**
 * Update all question hints with dynamic content
 */
function updateQuestionHints() {
    // Update hints for all questions except AI follow-up (which is set dynamically)
    const questionsToUpdate = ['accomplishments', 'blockers', 'priorities'];
    
    questionsToUpdate.forEach((fieldName, index) => {
        const questionNum = index + 1;
        const hintElement = document.querySelector(`#question${questionNum} .question-hint`);
        
        if (hintElement && QUESTIONS && QUESTIONS.DEFINITIONS) {
            const question = QUESTIONS.DEFINITIONS[fieldName];
            if (question && question.generateHint) {
                const hintText = question.generateHint(currentUserData, answerCache);
                hintElement.textContent = hintText;
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
 */
function signOut() {
    google.accounts.id.disableAutoSelect();
    currentUser = null;
    currentUserData = null;
    document.getElementById('formCard').classList.remove('active');
    document.getElementById('authCard').style.display = 'block';
    document.getElementById('authError').innerHTML = '';
    document.getElementById('feedbackForm').reset();
    
    // Clear answer cache
    Object.keys(answerCache).forEach(key => delete answerCache[key]);
    
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
async function nextQuestion(current) {
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

    // If moving from question 3, generate AI summary and follow-up
    if (current === 3) {
        const generateBtn = document.getElementById('generateAIBtn');
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="loading"></span> Analyzing your answers...';
        
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
            
            // Update question 4 hint with the AI-generated question
            const hintElement = document.getElementById('aiQuestionHint');
            if (hintElement) {
                hintElement.textContent = aiResponse.question;
                console.log('Updated hint element with AI question');
            } else {
                console.error('Could not find aiQuestionHint element');
            }
            
            generateBtn.innerHTML = 'Generate Follow-up Question →';
            generateBtn.disabled = false;
        } catch (error) {
            console.error('Error generating AI question:', error);
            console.error('Error details:', error.message, error.stack);
            const firstName = currentUserData.firstName || currentUserData.name.split(' ')[0];
            const fallbackQuestion = `Is there anything else important you'd like to discuss ${firstName}?`;
            document.getElementById('aiQuestionHint').textContent = fallbackQuestion;
            answerCache.aiSummary = 'Thank you for your updates.';
            answerCache.aiQuestion = fallbackQuestion;
            generateBtn.innerHTML = 'Generate Follow-up Question →';
            generateBtn.disabled = false;
        }
    }

    // Hide current, show next
    document.getElementById('question' + current).classList.remove('active');
    currentQuestion = current + 1;
    document.getElementById('question' + currentQuestion).classList.add('active');
    
    // Update hints for dynamic questions
    updateQuestionHints();
    
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
        action: 'submit', // Tell Apps Script this is a submission
        timestamp: new Date().toISOString(),
        name: currentUserData.name,
        email: currentUserData.email,
        // The three main answers
        accomplishments: answerCache.accomplishments || textareas.accomplishments.value,
        blockers: answerCache.blockers || textareas.blockers.value,
        priorities: answerCache.priorities || textareas.priorities.value,
        // AI-generated summary and question
        aiSummary: answerCache.aiSummary || '',
        aiQuestion: answerCache.aiQuestion || '',
        // Answer to the AI-generated question (FIX: correct textarea ID)
        aiAnswer: textareas.aiGeneratedQuestion ? textareas.aiGeneratedQuestion.value : document.getElementById('aiFollowUp').value
    };
    
    console.log('Submitting form data:', formData);

    try {
        console.log('Calling submitToGoogleSheets...');
        await submitToGoogleSheets(formData);
        console.log('Submission successful!');
        
        // Hide form, show success
        document.getElementById('question4').classList.remove('active');
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
// EXPOSE FUNCTIONS GLOBALLY
// ========================================

// Functions called from HTML need to be on window object
window.handleCredentialResponse = handleCredentialResponse;
window.signOut = signOut;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;

// Expose answer cache for use in dynamic question generation
window.getAnswerCache = () => answerCache;
window.getCachedAnswer = getCachedAnswer;
