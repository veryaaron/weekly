/**
 * AI Service for Report Analysis
 *
 * Uses Claude API to analyze weekly submissions and generate
 * intelligent executive reports with risk identification.
 */

import type {
  Logger,
  AIReportAnalysis,
  RiskAlert,
  TrendIndicator,
  TeamMemberSummary,
  WorkspaceSubmission
} from '../types';

// Submission with member info for analysis
export interface SubmissionWithMember extends WorkspaceSubmission {
  member_name: string;
  member_email: string;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Call Claude API
 */
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  logger: Logger
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Claude API error', new Error(errorText), {
      status: response.status,
    });
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json() as ClaudeResponse;
  return data.content[0]?.text || '';
}

/**
 * Analyze weekly submissions and generate AI-powered report
 */
export async function analyzeSubmissions(
  apiKey: string,
  submissions: SubmissionWithMember[],
  weekNumber: number,
  year: number,
  workspaceName: string,
  totalMembers: number,
  logger: Logger
): Promise<AIReportAnalysis> {
  logger.info('Starting AI analysis', {
    submissionCount: submissions.length,
    weekNumber,
    year,
  });

  // Build the analysis prompt
  const systemPrompt = `You are an expert business analyst helping managers understand their team's weekly progress.
Your role is to analyze weekly feedback submissions and produce a structured executive report.

CRITICAL: You must identify and flag any risks in these categories:
- Health & Safety: Physical safety concerns, workplace hazards, wellbeing issues, burnout indicators
- Legal & Compliance: Regulatory issues, contract risks, policy violations, data protection concerns
- Financial & Budget: Cost overruns, revenue risks, resource constraints, budget concerns

Be thorough but concise. Focus on actionable insights.

IMPORTANT: Respond ONLY with valid JSON matching the schema below. No markdown, no explanation, just the JSON object.`;

  const userMessage = `Analyze these ${submissions.length} weekly feedback submissions for Week ${weekNumber}, ${year}.
Workspace: ${workspaceName}
Total team members: ${totalMembers}
Submission rate: ${Math.round((submissions.length / totalMembers) * 100)}%

SUBMISSIONS:
${submissions.map((s, i) => `
--- SUBMISSION ${i + 1}: ${s.member_name} (${s.member_email}) ---
ACCOMPLISHMENTS THIS WEEK:
${s.accomplishments || 'None provided'}

PROGRESS ON LAST WEEK'S PRIORITIES:
${s.previous_week_progress || 'None provided'}

BLOCKERS:
${s.blockers || 'None provided'}

PRIORITIES FOR NEXT WEEK:
${s.priorities || 'None provided'}

SHOUTOUTS/RECOGNITION (team members who stood out):
${s.shoutouts || 'None provided'}
---
`).join('\n')}

Respond with a JSON object matching this exact structure:
{
  "executiveSummary": "2-3 paragraph overview of the week's progress, key themes, and overall team health",
  "keyHighlights": ["highlight 1", "highlight 2", "...up to 5 key positive highlights"],
  "teamRecognition": [
    {
      "recipient": "Name of person being recognized",
      "from": "Name of person giving recognition",
      "reason": "Why they were recognized"
    }
  ],
  "risks": [
    {
      "category": "health_safety" | "legal_compliance" | "financial_budget",
      "severity": "low" | "medium" | "high" | "critical",
      "title": "Brief title",
      "description": "Detailed description of the risk",
      "source": "Team member name who reported it",
      "recommendation": "Suggested action to mitigate"
    }
  ],
  "trends": [
    {
      "metric": "Name of trend",
      "direction": "up" | "down" | "stable",
      "description": "What this trend means"
    }
  ],
  "teamOverview": {
    "submissionRate": ${Math.round((submissions.length / totalMembers) * 100)},
    "totalMembers": ${totalMembers},
    "submittedCount": ${submissions.length},
    "commonThemes": ["theme1", "theme2", "...common themes across submissions"],
    "overallSentiment": "positive" | "neutral" | "concerned"
  },
  "memberSummaries": [
    {
      "memberId": "member's id",
      "memberName": "member's name",
      "memberEmail": "member's email",
      "summary": "1-2 sentence summary of their week",
      "keyAccomplishments": ["accomplishment 1", "..."],
      "progressOnPreviousPriorities": "Brief assessment of how they progressed on last week's priorities",
      "blockers": ["blocker 1", "..."],
      "priorities": ["priority 1", "..."],
      "shoutoutsGiven": ["who they recognized and why"],
      "sentiment": "positive" | "neutral" | "concerned",
      "riskFlags": ["any specific risks this person flagged"]
    }
  ],
  "recommendedActions": ["action 1", "action 2", "...top 3-5 recommended actions for the manager"]
}

IMPORTANT:
- Include a memberSummary for each of the ${submissions.length} submissions
- Extract ALL shoutouts/recognition mentions into the teamRecognition array
- If there are no risks in a category, return an empty risks array
- If there are no shoutouts, return an empty teamRecognition array
- Be specific and actionable in your analysis`;

  try {
    const responseText = await callClaude(apiKey, systemPrompt, userMessage, logger);

    // Parse the JSON response
    let analysis: AIReportAnalysis;
    try {
      // Clean up the response in case it has markdown code blocks
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }

      analysis = JSON.parse(cleanedResponse.trim());
    } catch (parseError) {
      logger.error('Failed to parse AI response', parseError, {
        responsePreview: responseText.substring(0, 500),
      });
      // Return a fallback analysis
      return createFallbackAnalysis(submissions, weekNumber, year, totalMembers);
    }

    // Validate and ensure all required fields exist
    analysis.generatedAt = new Date().toISOString();

    // Ensure risks have valid categories
    if (analysis.risks) {
      analysis.risks = analysis.risks.filter(r =>
        ['health_safety', 'legal_compliance', 'financial_budget'].includes(r.category)
      );
    }

    logger.info('AI analysis completed', {
      risksFound: analysis.risks?.length || 0,
      trendsFound: analysis.trends?.length || 0,
    });

    return analysis;

  } catch (error) {
    logger.error('AI analysis failed', error);
    return createFallbackAnalysis(submissions, weekNumber, year, totalMembers);
  }
}

/**
 * Create a fallback analysis when AI is unavailable
 */
function createFallbackAnalysis(
  submissions: SubmissionWithMember[],
  weekNumber: number,
  year: number,
  totalMembers: number
): AIReportAnalysis {
  const submissionRate = Math.round((submissions.length / totalMembers) * 100);

  // Extract shoutouts for fallback
  const shoutouts: Array<{ recipient: string; from: string; reason: string }> = [];
  submissions.forEach(s => {
    if (s.shoutouts) {
      shoutouts.push({
        recipient: 'See details',
        from: s.member_name,
        reason: s.shoutouts.substring(0, 200),
      });
    }
  });

  return {
    executiveSummary: `Week ${weekNumber} of ${year} report generated with ${submissions.length} out of ${totalMembers} team members submitting (${submissionRate}% response rate). AI analysis was unavailable - please review individual submissions below for details.`,
    keyHighlights: submissions
      .filter(s => s.accomplishments)
      .slice(0, 5)
      .map(s => `${s.member_name}: ${(s.accomplishments || '').split('\n')[0]?.substring(0, 100) || 'Submitted update'}`),
    teamRecognition: shoutouts,
    risks: [],
    trends: [{
      metric: 'Submission Rate',
      direction: submissionRate >= 80 ? 'up' : submissionRate >= 60 ? 'stable' : 'down',
      description: `${submissionRate}% of team submitted this week`,
    }],
    teamOverview: {
      submissionRate,
      totalMembers,
      submittedCount: submissions.length,
      commonThemes: ['See individual submissions for details'],
      overallSentiment: 'neutral',
    },
    memberSummaries: submissions.map(s => ({
      memberId: s.workspace_member_id,
      memberName: s.member_name,
      memberEmail: s.member_email,
      summary: s.accomplishments?.split('\n')[0]?.substring(0, 150) || 'Submitted weekly update',
      keyAccomplishments: (s.accomplishments || '').split('\n').filter(Boolean).slice(0, 3),
      progressOnPreviousPriorities: s.previous_week_progress || undefined,
      blockers: (s.blockers || '').split('\n').filter(Boolean),
      priorities: (s.priorities || '').split('\n').filter(Boolean),
      shoutoutsGiven: s.shoutouts ? [s.shoutouts] : [],
      sentiment: 'neutral' as const,
      riskFlags: [],
    })),
    recommendedActions: [
      submissions.length < totalMembers
        ? `Follow up with ${totalMembers - submissions.length} team members who haven't submitted`
        : 'All team members have submitted - great participation!',
      'Review individual blockers and provide support where needed',
    ],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a formatted markdown report from the analysis
 */
export function formatAnalysisAsMarkdown(
  analysis: AIReportAnalysis,
  weekNumber: number,
  year: number,
  workspaceName: string
): string {
  let md = `# Weekly Executive Report\n`;
  md += `## Week ${weekNumber}, ${year} | ${workspaceName}\n\n`;
  md += `*Generated: ${new Date(analysis.generatedAt).toLocaleString()}*\n\n`;

  // Risk Alerts (prominent placement)
  if (analysis.risks && analysis.risks.length > 0) {
    md += `## ⚠️ Risk Alerts\n\n`;

    const criticalRisks = analysis.risks.filter(r => r.severity === 'critical');
    const highRisks = analysis.risks.filter(r => r.severity === 'high');
    const otherRisks = analysis.risks.filter(r => !['critical', 'high'].includes(r.severity));

    if (criticalRisks.length > 0) {
      md += `### 🔴 Critical\n`;
      criticalRisks.forEach(r => {
        md += `- **${r.title}** (${formatCategory(r.category)})\n`;
        md += `  ${r.description}\n`;
        md += `  *Reported by: ${r.source}*\n`;
        if (r.recommendation) md += `  → ${r.recommendation}\n`;
        md += `\n`;
      });
    }

    if (highRisks.length > 0) {
      md += `### 🟠 High Priority\n`;
      highRisks.forEach(r => {
        md += `- **${r.title}** (${formatCategory(r.category)})\n`;
        md += `  ${r.description}\n`;
        md += `  *Reported by: ${r.source}*\n`;
        if (r.recommendation) md += `  → ${r.recommendation}\n`;
        md += `\n`;
      });
    }

    if (otherRisks.length > 0) {
      md += `### 🟡 Monitor\n`;
      otherRisks.forEach(r => {
        md += `- **${r.title}** (${formatCategory(r.category)}) - ${r.description}\n`;
      });
      md += `\n`;
    }
  }

  // Executive Summary
  md += `## Executive Summary\n\n`;
  md += `${analysis.executiveSummary}\n\n`;

  // Key Highlights
  if (analysis.keyHighlights && analysis.keyHighlights.length > 0) {
    md += `## 🌟 Key Highlights\n\n`;
    analysis.keyHighlights.forEach(h => {
      md += `- ${h}\n`;
    });
    md += `\n`;
  }

  // Team Recognition / Shoutouts
  if (analysis.teamRecognition && analysis.teamRecognition.length > 0) {
    md += `## 🏆 Team Recognition\n\n`;
    analysis.teamRecognition.forEach(r => {
      md += `- **${r.recipient}** recognized by ${r.from}: ${r.reason}\n`;
    });
    md += `\n`;
  }

  // Team Overview
  md += `## Team Overview\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Submission Rate | ${analysis.teamOverview.submissionRate}% |\n`;
  md += `| Submitted | ${analysis.teamOverview.submittedCount}/${analysis.teamOverview.totalMembers} |\n`;
  md += `| Overall Sentiment | ${formatSentiment(analysis.teamOverview.overallSentiment)} |\n`;
  md += `\n`;

  if (analysis.teamOverview.commonThemes.length > 0) {
    md += `**Common Themes:** ${analysis.teamOverview.commonThemes.join(', ')}\n\n`;
  }

  // Trends
  if (analysis.trends && analysis.trends.length > 0) {
    md += `## 📈 Trends\n\n`;
    analysis.trends.forEach(t => {
      const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
      md += `- ${arrow} **${t.metric}**: ${t.description}\n`;
    });
    md += `\n`;
  }

  // Recommended Actions
  if (analysis.recommendedActions && analysis.recommendedActions.length > 0) {
    md += `## ✅ Recommended Actions\n\n`;
    analysis.recommendedActions.forEach((a, i) => {
      md += `${i + 1}. ${a}\n`;
    });
    md += `\n`;
  }

  // Individual Summaries
  md += `## Team Member Updates\n\n`;
  analysis.memberSummaries.forEach(m => {
    const sentimentIcon = m.sentiment === 'positive' ? '😊' : m.sentiment === 'concerned' ? '😟' : '😐';
    md += `### ${m.memberName} ${sentimentIcon}\n\n`;
    md += `${m.summary}\n\n`;

    if (m.keyAccomplishments.length > 0) {
      md += `**Accomplishments:**\n`;
      m.keyAccomplishments.forEach(a => md += `- ${a}\n`);
      md += `\n`;
    }

    if (m.blockers.length > 0) {
      md += `**Blockers:**\n`;
      m.blockers.forEach(b => md += `- ${b}\n`);
      md += `\n`;
    }

    if (m.priorities.length > 0) {
      md += `**Priorities:**\n`;
      m.priorities.forEach(p => md += `- ${p}\n`);
      md += `\n`;
    }

    if (m.riskFlags.length > 0) {
      md += `**⚠️ Risk Flags:** ${m.riskFlags.join(', ')}\n\n`;
    }

    md += `---\n\n`;
  });

  return md;
}

function formatCategory(category: string): string {
  const categories: Record<string, string> = {
    'health_safety': 'Health & Safety',
    'legal_compliance': 'Legal/Compliance',
    'financial_budget': 'Financial/Budget',
  };
  return categories[category] || category;
}

function formatSentiment(sentiment: string): string {
  const sentiments: Record<string, string> = {
    'positive': '😊 Positive',
    'neutral': '😐 Neutral',
    'concerned': '😟 Concerned',
  };
  return sentiments[sentiment] || sentiment;
}
