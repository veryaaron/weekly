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
 * Generate AI summary and follow-up question based on first 3 answers
 */
async function generateAIFollowUpQuestion(userData, cachedAnswers) {
    const firstName = userData.firstName || userData.name.split(' ')[0];
    
    const prompt = `I am conducting a weekly check-in with ${firstName}. They have answered these three questions:

Question 1 - Key Accomplishments This Week:
"${cachedAnswers.accomplishments || 'No answer provided'}"

Question 2 - Blockers & Challenges (what is currently blocking your path, what support or resources do you need):
"${cachedAnswers.blockers || 'No answer provided'}"

Question 3 - Priorities (current priorities and if they're happy this is the right priority list for the business):
"${cachedAnswers.priorities || 'No answer provided'}"

Please:
1. Summarize the answers given to these three questions in 2-3 sentences
2. Ask ONE question that you think is pertinent to the answers given

Format your response exactly as:
SUMMARY: [your 2-3 sentence summary]
QUESTION: [your single pertinent question]`;

    try {
        console.log('Generating AI question for:', firstName);
        console.log('Accomplishments:', cachedAnswers.accomplishments?.substring(0, 50) + '...');
        console.log('Blockers:', cachedAnswers.blockers?.substring(0, 50) + '...');
        console.log('Priorities:', cachedAnswers.priorities?.substring(0, 50) + '...');
        
        const headers = {
            'Content-Type': 'application/json',
        };
        
        // Add API key if configured
        if (window.FEEDBACK_CONFIG && window.FEEDBACK_CONFIG.ANTHROPIC_API_KEY) {
            headers['x-api-key'] = window.FEEDBACK_CONFIG.ANTHROPIC_API_KEY;
            console.log('Using configured API key');
        } else {
            console.log('No API key configured, using public endpoint');
        }

        console.log('Calling Anthropic API...');
        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: window.FEEDBACK_CONFIG?.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
                max_tokens: 500,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        console.log('API Response status:', apiResponse.status);
        
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('API Error response:', errorText);
            throw new Error(`API returned ${apiResponse.status}: ${errorText}`);
        }

        const data = await apiResponse.json();
        console.log('API Response data:', data);
        
        const response = data.content[0].text.trim();
        
        console.log('AI Generated text:', response);
        
        // Parse the response to extract summary and question
        const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=QUESTION:|$)/s);
        const questionMatch = response.match(/QUESTION:\s*(.+?)$/s);
        
        const result = {
            summary: summaryMatch ? summaryMatch[1].trim() : '',
            question: questionMatch ? questionMatch[1].trim() : 'What else would you like to share about this week?'
        };
        
        console.log('Parsed result:', result);
        
        return result;
    } catch (error) {
        console.error('Error in generateAIFollowUpQuestion:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Fallback
        return {
            summary: 'Thank you for sharing your updates this week.',
            question: 'Is there anything else important you\'d like to discuss?'
        };
    }
}

// Make available globally
window.QUESTIONS = QUESTIONS;
window.generateAIFollowUpQuestion = generateAIFollowUpQuestion;
