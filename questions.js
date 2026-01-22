/**
 * QUESTIONS.JS
 * ============
 * 
 * Question definitions, dynamic text generation, and question-specific logic
 */

const QUESTIONS = {
    // Total number of questions
    TOTAL: 4,
    
    // Minimum characters before AI suggestions are enabled
    MIN_CHARS_FOR_AI: 10,
    
    // Question definitions
    DEFINITIONS: {
        accomplishments: {
            id: 'accomplishments',
            required: true,
            label: 'Key Accomplishments This Week',
            
            // Dynamic hint generator - called when user signs in
            generateHint: function(userData, cachedAnswers) {
                const greeting = getTimeBasedGreeting();
                const firstName = userData.firstName || userData.name.split(' ')[0];
                
                return `Good ${greeting} ${firstName}, what significant progress did you or your team make this week? Think about completed projects, milestones reached, sales achieved, problems solved, or goals achieved. Aim for three pieces of news.`;
            },
            
            // AI prompt for suggestions
            aiPrompt: function(userResponse) {
                return `The user wrote: "${userResponse}"\n\nThis is for their weekly accomplishments. Provide 2-3 specific suggestions to make this more impactful: add metrics/data, explain the impact/outcome, or clarify what was achieved. Be constructive and encouraging.`;
            }
        },
        
        blockers: {
            id: 'blockers',
            required: true,
            label: 'Blockers & Challenges',
            
            // Static hint (can be dynamic if needed)
            generateHint: function(userData, cachedAnswers) {
                return 'What obstacles are preventing progress? What support or resources do you need? Be specific about what\'s blocking you and what would help resolve it.';
            },
            
            aiPrompt: function(userResponse) {
                return `The user wrote: "${userResponse}"\n\nThis describes their blockers/challenges. Provide 2-3 specific suggestions: make the blocker more clear, specify what help they need, or explain the impact. Be supportive and solution-focused.`;
            }
        },
        
        morale: {
            id: 'morale',
            required: true,
            label: 'Team Morale & Energy',
            
            generateHint: function(userData, cachedAnswers) {
                return 'How is your team feeling right now? What\'s driving energy levels? Any concerns or positive momentum? Include specific examples or observations.';
            },
            
            aiPrompt: function(userResponse) {
                return `The user wrote: "${userResponse}"\n\nThis is about team morale. Provide 2-3 specific suggestions: add concrete examples, explain what\'s driving the energy (positive or negative), or clarify team sentiment. Be empathetic.`;
            }
        },
        
        ideas: {
            id: 'ideas',
            required: false,
            label: 'Bright Ideas',
            
            generateHint: function(userData, cachedAnswers) {
                return 'Any innovative suggestions or opportunities you\'ve identified? What\'s the potential impact? How might it be implemented? (Optional - skip if you don\'t have any this week)';
            },
            
            aiPrompt: function(userResponse) {
                return `The user wrote: "${userResponse}"\n\nThis is a bright idea. Provide 2-3 specific suggestions: elaborate on the potential impact, explain implementation approach, or clarify the opportunity. Be encouraging of innovation.`;
            }
        }
    },
    
    // Get question order (array of field names)
    getOrder: function() {
        return ['accomplishments', 'blockers', 'morale', 'ideas'];
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

// Make available globally
window.QUESTIONS = QUESTIONS;
