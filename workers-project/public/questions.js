/**
 * QUESTIONS.JS
 * ============
 *
 * Question definitions, dynamic text generation, and question-specific logic
 *
 * v2.2 - New Questions
 * - Added previousWeekProgress (Q2) - shows summary of last week, asks about progress
 * - Added shoutouts (Q5) - optional recognition/shoutout question
 * - Updated question flow: accomplishments → previousWeekProgress → blockers → priorities → shoutouts → aiFollowUp
 */

const QUESTIONS = {
    // Total number of questions (5 manual + 1 AI-generated)
    // Note: previousWeekProgress is conditionally shown based on whether user has previous data
    TOTAL: 6,

    // Minimum characters before moving to next question
    MIN_CHARS_TO_CONTINUE: 10,

    // Question definitions
    DEFINITIONS: {
        accomplishments: {
            id: 'accomplishments',
            questionNumber: 1,
            required: true,
            label: 'Key Accomplishments This Week',
            showAIButton: false,

            // Dynamic hint generator
            generateHint: function(userData, cachedAnswers) {
                const greeting = getTimeBasedGreeting();
                const firstName = userData.firstName || userData.name.split(' ')[0];

                return `Good ${greeting} ${firstName}, what significant progress did you or your team make this week? Think about completed projects, milestones reached, sales achieved, problems solved, or goals achieved. Aim for three pieces of news.`;
            }
        },

        previousWeekProgress: {
            id: 'previousWeekProgress',
            questionNumber: 2,
            required: false,  // Optional - only shown if previous week data exists
            conditional: true,  // Conditionally shown
            label: 'Progress on Last Week\'s Priorities',
            showAIButton: false,

            generateHint: function(userData, cachedAnswers) {
                const firstName = userData.firstName || userData.name.split(' ')[0];

                // Check if we have previous week data
                if (userData.previousWeek && userData.previousWeek.priorities) {
                    const prevPriorities = userData.previousWeek.priorities;
                    // Truncate if too long
                    const truncated = prevPriorities.length > 300
                        ? prevPriorities.substring(0, 300) + '...'
                        : prevPriorities;

                    return `${firstName}, last week your priorities were:\n\n"${truncated}"\n\nHow did you progress on these? What got done, what's still in flight?`;
                }

                return `${firstName}, how did you progress on last week's priorities?`;
            },

            // Generate summary of previous week for display
            generatePreviousWeekSummary: function(userData) {
                if (!userData.previousWeek) return null;

                const prev = userData.previousWeek;
                return {
                    accomplishments: prev.accomplishments || 'No accomplishments recorded',
                    blockers: prev.blockers || 'No blockers recorded',
                    priorities: prev.priorities || 'No priorities recorded'
                };
            }
        },

        blockers: {
            id: 'blockers',
            questionNumber: 3,
            required: true,
            label: 'Blockers & Challenges',
            showAIButton: false,

            generateHint: function(userData, cachedAnswers) {
                const firstName = userData.firstName || userData.name.split(' ')[0];
                return `Great, now we've discussed achievements ${firstName}, what is currently blocking your path? What support or resources do you need?`;
            }
        },

        priorities: {
            id: 'priorities',
            questionNumber: 4,
            required: true,
            label: 'Priorities',
            showAIButton: false,

            generateHint: function(userData, cachedAnswers) {
                const firstName = userData.firstName || userData.name.split(' ')[0];
                return `What are your current priorities ${firstName} and are you happy this is definitely the right priority list for the business or would you like to discuss them?`;
            }
        },

        shoutouts: {
            id: 'shoutouts',
            questionNumber: 5,
            required: false,  // Optional field
            label: 'Shoutouts & Recognition',
            showAIButton: false,

            generateHint: function(userData, cachedAnswers) {
                const firstName = userData.firstName || userData.name.split(' ')[0];
                return `${firstName}, is there anyone you'd like to recognize for great work, collaboration, or support this week? (Optional - feel free to skip if nothing comes to mind)`;
            }
        },

        aiFollowUp: {
            id: 'aiFollowUp',
            questionNumber: 6,
            required: true,
            label: '', // Will be dynamically set by AI
            showAIButton: false,

            generateHint: function(userData, cachedAnswers) {
                // This will be replaced with AI-generated question
                return 'Loading your personalized follow-up question...';
            }
        }
    },

    // Get question order (array of field names)
    // v2.2: Updated order with new questions
    getOrder: function() {
        return ['accomplishments', 'previousWeekProgress', 'blockers', 'priorities', 'shoutouts', 'aiFollowUp'];
    },

    // Get visible question order (excludes conditional questions that aren't shown)
    getVisibleOrder: function(userData) {
        const allQuestions = this.getOrder();

        return allQuestions.filter(fieldName => {
            const question = this.DEFINITIONS[fieldName];

            // If question is conditional, check if it should be shown
            if (question.conditional) {
                // previousWeekProgress only shows if user has previous week data
                if (fieldName === 'previousWeekProgress') {
                    return userData && userData.previousWeek;
                }
            }

            return true;
        });
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
    },

    // Check if a question should be skipped based on user data
    shouldSkipQuestion: function(fieldName, userData) {
        const question = this.DEFINITIONS[fieldName];

        if (!question) return false;

        // Skip previousWeekProgress if no previous week data
        if (fieldName === 'previousWeekProgress' && question.conditional) {
            return !userData || !userData.previousWeek;
        }

        return false;
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
