/**
 * QUESTIONS.JS
 * ============
 * 
 * Question definitions, dynamic text generation, and question-specific logic
 */

const QUESTIONS = {
    // Total number of questions (3 manual + 1 AI-generated)
    TOTAL: 4,
    
    // Minimum characters before moving to next question
    MIN_CHARS_TO_CONTINUE: 10,
    
    // Question definitions
    DEFINITIONS: {
        accomplishments: {
            id: 'accomplishments',
            questionNumber: 1,
            required: true,
            label: 'Key Accomplishments This Week',
            showAIButton: false, // No AI button on this question
            
            // Dynamic hint generator
            generateHint: function(userData, cachedAnswers) {
                const greeting = getTimeBasedGreeting();
                const firstName = userData.firstName || userData.name.split(' ')[0];
                
                return `Good ${greeting} ${firstName}, what significant progress did you or your team make this week? Think about completed projects, milestones reached, sales achieved, problems solved, or goals achieved. Aim for three pieces of news.`;
            }
        },
        
        blockers: {
            id: 'blockers',
            questionNumber: 2,
            required: true,
            label: 'Blockers & Challenges',
            showAIButton: false, // No AI button on this question
            
            generateHint: function(userData, cachedAnswers) {
                const firstName = userData.firstName || userData.name.split(' ')[0];
                return `Great, now we've discussed achievements ${firstName}, what is currently blocking your path? What support or resources do you need?`;
            }
        },
        
        priorities: {
            id: 'priorities',
            questionNumber: 3,
            required: true,
            label: 'Priorities',
            showAIButton: false, // No AI button on this question
            
            generateHint: function(userData, cachedAnswers) {
                const firstName = userData.firstName || userData.name.split(' ')[0];
                return `What are your current priorities ${firstName} and are you happy this is definitely the right priority list for the business or would you like to discuss them?`;
            }
        },
        
        aiFollowUp: {
            id: 'aiFollowUp',
            questionNumber: 4,
            required: true,
            label: '', // Will be dynamically set by AI
            showAIButton: false, // No AI button on AI-generated question
            
            generateHint: function(userData, cachedAnswers) {
                // This will be replaced with AI-generated question
                return 'Loading your personalized follow-up question...';
            }
        }
    },
    
    // Get question order (array of field names)
    getOrder: function() {
        return ['accomplishments', 'blockers', 'priorities', 'aiFollowUp'];
    },
    
    // Get question by index (1-based)
    getByIndex: function(index) {
        const order = this.getOrder();
        const fieldName = order[index - 1];
        return this.DEFINITIONS[fieldName];
    },
    
    // Get field name by index (1-based)
    getFieldByIndex: function(index) {
        return this.getOrder()[index - 1];
    }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get greeting based on time of day
 */
function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    
    if (hour < 12) {
        return 'morning';
    } else if (hour < 18) {
        return 'afternoon';
    } else {
        return 'evening';
    }
}

/**
 * Generate AI summary and follow-up question via Google Apps Script
 * The API key is securely stored in Google Apps Script properties
 */
async function generateAIFollowUpQuestion(userData, cachedAnswers) {
    const firstName = userData.firstName || userData.name.split(' ')[0];
    
    console.log('Generating AI question via Google Apps Script...');
    console.log('User:', firstName);
    
    try {
        const scriptUrl = window.FEEDBACK_CONFIG?.GOOGLE_SCRIPT_URL;
        
        if (!scriptUrl) {
            throw new Error('Google Script URL not configured');
        }
        
        console.log('Calling Apps Script at:', scriptUrl);
        
        const response = await fetch(scriptUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain', // Avoid CORS preflight
            },
            body: JSON.stringify({
                action: 'generate',
                firstName: firstName,
                accomplishments: cachedAnswers.accomplishments || '',
                blockers: cachedAnswers.blockers || '',
                priorities: cachedAnswers.priorities || ''
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response type:', response.type);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.status === 'success') {
            return {
                summary: data.summary || '',
                question: data.question || 'What else would you like to share about this week?'
            };
        } else {
            throw new Error(data.message || 'Unknown error from server');
        }
        
    } catch (error) {
        console.error('Error generating AI question:', error);
        console.error('Error details:', error.message);
        
        // Fallback
        return {
            summary: 'Thank you for sharing your updates this week.',
            question: `Is there anything else important you'd like to discuss, ${firstName}?`
        };
    }
}

// Make available globally
window.QUESTIONS = QUESTIONS;
window.generateAIFollowUpQuestion = generateAIFollowUpQuestion;
