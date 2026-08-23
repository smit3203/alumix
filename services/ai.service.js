const Groq = require('groq-sdk');
require('dotenv').config();

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey && apiKey !== 'gsk_your_groq_api_key_here') {
    try {
      return new Groq({ apiKey });
    } catch (err) {
      console.warn('Failed to initialize Groq client:', err.message);
    }
  }
  return null;
}

/**
 * Sends student's natural-language query to Groq LLM to extract structured requirements.
 * @param {string} prompt 
 * @returns {Promise<Object>} JSON object with extracted requirements
 */
async function extractQueryRequirements(prompt) {
  const fallbackResult = {
    interests: [],
    skills: [],
    job_roles: [],
    location: [],
    graduation_year: null,
    branch: null,
    experience: null,
    other_requirements: [],
  };

  const groqClient = getGroqClient();
  if (!groqClient) {
    console.warn('Groq client not available. Extracting keywords using rule fallback.');
    // Simple keyword extraction fallback
    const lower = prompt.toLowerCase();
    if (lower.includes('cybersecurity') || lower.includes('security')) {
      fallbackResult.interests.push('cybersecurity');
      fallbackResult.job_roles.push('cybersecurity');
    }
    if (lower.includes('python')) fallbackResult.skills.push('Python');
    if (lower.includes('google')) fallbackResult.other_requirements.push('Google');
    if (lower.includes('referral')) fallbackResult.other_requirements.push('referral');
    return fallbackResult;
  }

  const systemPrompt = `You are an AI assistant for an Alumni Career System. 
Your task is to analyze a student's natural language request seeking alumni guidance and extract structured search parameters into valid JSON ONLY.

JSON Schema:
{
    "interests": Array of string (e.g. ["cybersecurity", "web development"]),
    "skills": Array of string (e.g. ["Python", "React"]),
    "job_roles": Array of string (e.g. ["Software Engineer", "Cybersecurity Specialist"]),
    "location": Array of string (e.g. ["Bangalore", "San Francisco"]),
    "graduation_year": integer or null,
    "branch": string or null (e.g. "Computer Engineering"),
    "experience": integer or null (years of experience requested),
    "other_requirements": Array of string (e.g. ["internship guidance", "referral"])
}

Do NOT include any commentary, markdown formatting, or preamble outside the JSON object. Output RAW JSON ONLY.`;

  try {
    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(responseText);

    return {
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      job_roles: Array.isArray(parsed.job_roles) ? parsed.job_roles : [],
      location: Array.isArray(parsed.location) ? parsed.location : [],
      graduation_year: parsed.graduation_year || null,
      branch: parsed.branch || null,
      experience: parsed.experience || null,
      other_requirements: Array.isArray(parsed.other_requirements) ? parsed.other_requirements : [],
    };
  } catch (error) {
    console.error('Error calling Groq API for query extraction:', error.message);
    return fallbackResult;
  }
}

/**
 * Generate a short explanation for why an alumnus matches the student's request.
 * @param {string} studentQuery 
 * @param {Object} alumni 
 * @returns {Promise<string>}
 */
async function generateMatchExplanation(studentQuery, alumni) {
  const groqClient = getGroqClient();
  if (!groqClient) {
    return `Matches interest in ${alumni.job_role} at ${alumni.company_name || 'top firm'} with background in ${alumni.department_name || 'Engineering'}.`;
  }

  try {
    const systemPrompt = `You are a concise career matching assistant. Write a single short sentence (max 20 words) explaining why this alumnus matches the student's request.`;
    const userPrompt = `Student request: "${studentQuery}"
Alumnus details:
Name: ${alumni.name}
Role: ${alumni.job_role}
Company: ${alumni.company_name}
Skills: ${alumni.skills_list || ''}
Bio: ${alumni.bio || ''}

Explanation:`;

    const completion = await groqClient.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 60,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() || 
      `Expert in ${alumni.job_role} with active willingness to guide students.`;
  } catch (error) {
    return `Specialist in ${alumni.job_role} at ${alumni.company_name || 'industry leader'}.`;
  }
}

module.exports = {
  extractQueryRequirements,
  generateMatchExplanation,
};
