// Quizio - Quiz Generation Function
// Uses Anthropic Claude API to generate quiz questions

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ error: 'Method not allowed' }) 
        };
    }

    try {
        const { topic } = JSON.parse(event.body);

        if (!topic || topic.length > 100) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid topic' })
            };
        }

        // Safety check - block inappropriate topics
        const blockedPatterns = [
            /\b(porn|xxx|sex|nude|naked|hentai)\b/i,
            /\b(kill|murder|suicide|terroris|bomb|weapon)\b/i,
            /\b(drug|cocaine|heroin|meth)\b/i,
            /\b(child|minor|underage).*(sex|abuse|porn)/i,
            /\b(rape|assault|molest)\b/i,
            /\b(nazi|hitler|white\s*power|kkk)\b/i,
            /how\s+to\s+(hack|steal|forge)/i,
        ];

        if (blockedPatterns.some(pattern => pattern.test(topic))) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Topic not allowed' })
            };
        }

        // Call Anthropic API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{
                    role: 'user',
                    content: `Generate a quiz with exactly 5 multiple choice questions about: ${topic}

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{
    "questions": [
        {
            "question": "Question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct": 0
        }
    ]
}

Rules:
- Exactly 5 questions
- Exactly 4 options per question (A, B, C, D)
- "correct" is the index (0-3) of the correct answer
- Mix of easy, medium, and hard questions
- Questions should be factual and verifiable
- Keep questions engaging and interesting
- For celebrities/entertainment: focus on career facts, not personal gossip
- For education: ensure accuracy

Return ONLY the JSON, no markdown, no explanation.`
                }]
            })
        });

        if (!response.ok) {
            console.error('Anthropic API error:', response.status);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to generate quiz' })
            };
        }

        const data = await response.json();
        const content = data.content[0].text;

        // Parse the JSON response
        let quiz;
        try {
            // Try to extract JSON if wrapped in markdown
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                quiz = JSON.parse(jsonMatch[0]);
            } else {
                quiz = JSON.parse(content);
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError, content);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to parse quiz' })
            };
        }

        // Validate quiz structure
        if (!quiz.questions || quiz.questions.length !== 5) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Invalid quiz format' })
            };
        }

        // Validate each question
        for (const q of quiz.questions) {
            if (!q.question || !q.options || q.options.length !== 4 || 
                typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Invalid question format' })
                };
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(quiz)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
