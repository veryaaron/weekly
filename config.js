/**
 * CONFIGURATION FILE
 * ===================
 * 
 * This file contains all configurable settings for the Weekly Feedback Form.
 * Update these values as needed - no other files need to be modified.
 */

const CONFIG = {
    // Google OAuth Settings
    // Get this from Google Cloud Console > Credentials
    GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',
    
    // Domain restriction for email authentication
    // Only users with emails ending in this domain can access the form
    ALLOWED_DOMAIN: 'kubapay.com',
    
    // Google Apps Script URL
    // This is where form submissions are sent
    GOOGLE_SCRIPT_URL: 'https://script.google.com/a/macros/kubapay.com/s/AKfycbwT3ch8qlftL0rOz6ZwvzA_U8GF44JM-YqLwO1HHxwWrMImumlqSKDARNRwnDVqT_BT/exec',
    
    // Anthropic API Settings (Optional - for AI suggestions)
    // Leave blank to use the public API (has rate limits)
    // Get API key from: https://console.anthropic.com
    ANTHROPIC_API_KEY: '', // Optional: Add your API key here if you have one
    
    // Claude Model Configuration
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
    CLAUDE_MAX_TOKENS: 1000,
    
    // Form Settings
    FORM_SETTINGS: {
        // Minimum characters before AI suggestions are enabled
        MIN_CHARS_FOR_AI: 10,
        
        // Auto-logout after successful submission (milliseconds)
        AUTO_LOGOUT_DELAY: 5000, // 5 seconds
        
        // Total number of questions (excluding name)
        TOTAL_QUESTIONS: 4,
        
        // Question configuration
        QUESTIONS: {
            accomplishments: {
                required: true,
                label: 'Key Accomplishments',
                hint: 'What significant progress did you or your team make this week? Think about completed projects, milestones reached, problems solved, or goals achieved.'
            },
            blockers: {
                required: true,
                label: 'Blockers & Challenges',
                hint: 'What obstacles are preventing progress? What support or resources do you need? Be specific about what\'s blocking you and what would help resolve it.'
            },
            morale: {
                required: true,
                label: 'Team Morale & Energy',
                hint: 'How is your team feeling right now? What\'s driving energy levels? Any concerns or positive momentum? Include specific examples or observations.'
            },
            ideas: {
                required: false,
                label: 'Bright Ideas',
                hint: 'Any innovative suggestions or opportunities you\'ve identified? What\'s the potential impact? How might it be implemented? (Optional - skip if you don\'t have any this week)'
            }
        }
    },
    
    // UI Text Configuration
    TEXT: {
        appTitle: 'Weekly Feedback',
        appSubtitle: 'Share your week\'s highlights, challenges, and ideas',
        authTitle: '🔐 Kubapay Team Access',
        authSubtitle: 'Please sign in with your @kubapay.com Google account',
        successTitle: '✓ Feedback Submitted Successfully!',
        successMessage: 'Thank you for sharing your weekly update. Your manager will review this shortly.',
        aiButtonText: '✨ Get AI Help to Improve This',
        aiButtonLoading: 'Analyzing...',
        aiSuggestionHeader: '🤖 Claude\'s Suggestions',
        submitButtonText: 'Submit Feedback ✓',
        submitButtonLoading: 'Submitting...',
        continueButtonText: 'Continue →',
        backButtonText: '← Back',
        signOutButtonText: 'Sign Out'
    },
    
    // Error Messages
    ERRORS: {
        wrongDomain: (email, domain) => `⛔ Access Denied\nYou must sign in with a @${domain} email address.\nYour email: ${email}`,
        missingAnswer: 'Please provide an answer before continuing',
        aiMinChars: 'Please write at least a sentence before asking for AI help',
        aiError: 'Could not get AI suggestions. Please continue with your response.',
        submissionError: 'Could not submit feedback. Please try again or contact your manager.',
        notSignedIn: 'Please sign in first'
    }
};

// Make config available globally
window.FEEDBACK_CONFIG = CONFIG;
