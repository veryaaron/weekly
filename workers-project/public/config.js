/**
 * CONFIGURATION FILE
 * ===================
 *
 * Configuration for Weekly Feedback Form - Cloudflare Workers Deployment
 * v2.2 - Updated for tools.kubagroup.com
 */

const CONFIG = {
    // Google OAuth Settings
    GOOGLE_CLIENT_ID: '287284865613-fq9mql1qvr9sqogv6tjgde29o2bhidri.apps.googleusercontent.com',

    // Domain restriction for email authentication
    ALLOWED_DOMAINS: ['kubapay.com', 'vixtechnology.com', 'voqa.com'],

    // Admin users who can generate reports
    ADMIN_EMAILS: [
        'aaron@kubapay.com'
    ],

    // Google Apps Script URL
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwMabfFbwWpBKiyRVcFsB9vz5oJjbp30JtuEtyt5GBKTyFf6r_MDHA0cqAv_GGokzjhew/exec',

    // Claude Model Configuration
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
    CLAUDE_MAX_TOKENS: 1000,

    // Form Settings
    FORM_SETTINGS: {
        AUTO_LOGOUT_DELAY: 5000
    },

    // UI Text Configuration
    TEXT: {
        appTitle: 'Weekly Feedback',
        appSubtitle: 'Share your week\\'s highlights, challenges, and ideas',
        authTitle: 'Team Access',
        authSubtitle: 'Please sign in with your company Google account',
        successTitle: '✓ Feedback Submitted Successfully!',
        successMessage: 'Thank you for sharing your weekly update. Your manager will review this shortly.',
        submitButtonText: 'Submit Feedback ✓',
        submitButtonLoading: 'Submitting...',
        continueButtonText: 'Continue →',
        backButtonText: '← Back',
        signOutButtonText: 'Sign Out'
    },

    // Error Messages
    ERRORS: {
        wrongDomain: (email, domain) => \`⛔ Access Denied\\nYou must sign in with a @\${domain} email address.\\nYour email: \${email}\`,
        missingAnswer: 'Please provide an answer before continuing',
        submissionError: 'Could not submit feedback. Please try again or contact your manager.',
        notSignedIn: 'Please sign in first'
    }
};

// Make config available globally
window.FEEDBACK_CONFIG = CONFIG;
