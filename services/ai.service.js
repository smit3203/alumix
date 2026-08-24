const Groq = require('groq-sdk');
require('dotenv').config();

const MODELS_TO_TRY = [
  process.env.GROQ_MODEL,
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
].filter(Boolean);

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey && apiKey !== 'gsk_your_groq_api_key_here' && apiKey.trim().length > 10) {
    try {
      return new Groq({ apiKey: apiKey.trim() });
    } catch (err) {
      console.warn('Failed to initialize Groq client:', err.message);
    }
  }
  return null;
}

/**
 * Safely extracts and parses JSON even if wrapped in markdown code blocks
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

/**
 * Enhanced Offline/Rule-based keyword extraction
 */
function extractOfflineKeywords(prompt) {
  const lower = prompt.toLowerCase();
  const result = {
    interests: [],
    skills: [],
    job_roles: [],
    location: [],
    graduation_year: null,
    branch: null,
    experience: null,
    other_requirements: [],
  };

  const skillDict = [
    { name: 'Cybersecurity', matches: ['cybersecurity', 'security', 'infosec', 'pentest', 'ethical hacking'] },
    { name: 'Network Security', matches: ['network security', 'firewall', 'wireshark'] },
    { name: 'Penetration Testing', matches: ['penetration testing', 'pentest', 'red team', 'ctf'] },
    { name: 'Python', matches: ['python', 'django', 'flask', 'fastapi'] },
    { name: 'JavaScript', matches: ['javascript', 'js', 'node', 'express'] },
    { name: 'TypeScript', matches: ['typescript', 'ts'] },
    { name: 'React.js', matches: ['react', 'react.js', 'frontend'] },
    { name: 'Node.js', matches: ['node.js', 'node', 'backend'] },
    { name: 'Machine Learning', matches: ['machine learning', 'ml', 'ai', 'data science', 'llm'] },
    { name: 'Deep Learning', matches: ['deep learning', 'pytorch', 'tensorflow', 'neural'] },
    { name: 'PostgreSQL', matches: ['postgresql', 'postgres', 'sql', 'database'] },
    { name: 'Docker & Kubernetes', matches: ['docker', 'kubernetes', 'k8s', 'container'] },
    { name: 'AWS', matches: ['aws', 'cloud', 'amazon web services'] },
    { name: 'CI/CD Pipelines', matches: ['ci/cd', 'devops', 'pipelines', 'github actions'] },
    { name: 'Data Structures & Algorithms', matches: ['dsa', 'algorithms', 'data structures', 'leetcode'] },
    { name: 'System Design', matches: ['system design', 'architecture', 'distributed'] },
    { name: 'C++', matches: ['c++', 'cpp'] },
    { name: 'Java', matches: ['java', 'spring', 'springboot'] },
  ];

  for (const s of skillDict) {
    if (s.matches.some(m => lower.includes(m))) {
      result.skills.push(s.name);
    }
  }

  const roleDict = [
    { name: 'Cybersecurity Engineer', matches: ['cybersecurity', 'security engineer', 'security analyst'] },
    { name: 'AI / Machine Learning Engineer', matches: ['machine learning', 'ai engineer', 'ml engineer', 'data scientist'] },
    { name: 'Full Stack Software Engineer', matches: ['full stack', 'fullstack', 'web developer', 'software engineer', 'swe', 'sde'] },
    { name: 'DevOps / Cloud Engineer', matches: ['devops', 'cloud engineer', 'sre', 'infrastructure'] },
  ];

  for (const r of roleDict) {
    if (r.matches.some(m => lower.includes(m))) {
      result.job_roles.push(r.name);
    }
  }

  const companyDict = ['Google', 'Microsoft', 'CrowdStrike', 'Amazon', 'Meta', 'Apple', 'Palo Alto Networks'];
  for (const c of companyDict) {
    if (lower.includes(c.toLowerCase())) {
      result.other_requirements.push(`Company: ${c}`);
    }
  }

  if (lower.includes('referral') || lower.includes('refer')) {
    result.other_requirements.push('Referral Guidance');
  }
  if (lower.includes('mentor') || lower.includes('mentorship') || lower.includes('guidance')) {
    result.other_requirements.push('Active Mentorship');
  }
  if (lower.includes('internship') || lower.includes('intern')) {
    result.other_requirements.push('Internship Advice');
  }

  // Branch matching
  if (lower.includes('computer') || lower.includes('ce') || lower.includes('cse')) {
    result.branch = 'Computer Engineering';
  } else if (lower.includes('information technology') || lower.includes('it')) {
    result.branch = 'Information Technology';
  }

  // Graduation year regex (e.g. 2020, 2021, 2022...)
  const yearMatch = prompt.match(/\b(201[5-9]|202[0-9])\b/);
  if (yearMatch) {
    result.graduation_year = parseInt(yearMatch[1], 10);
  }

  // Experience regex (e.g. "3 years", "5+ years", "2 yrs")
  const expMatch = prompt.match(/(\d+)\s*(?:\+)?\s*(?:year|yr)s?/i);
  if (expMatch) {
    result.experience = parseInt(expMatch[1], 10);
  }

  return result;
}

/**
 * Sends student's natural-language query to Groq LLM to extract structured requirements.
 * @param {string} prompt 
 * @returns {Promise<Object>} JSON object with extracted requirements
 */
async function extractQueryRequirements(prompt) {
  const offlineResult = extractOfflineKeywords(prompt);
  const groqClient = getGroqClient();

  if (!groqClient) {
    return offlineResult;
  }

  const systemPrompt = `You are an AI assistant for an Alumni Career System. 
Analyze the student's request seeking alumni guidance and extract structured search parameters into valid JSON ONLY.

JSON Schema:
{
    "interests": Array of string (e.g. ["cybersecurity", "web development"]),
    "skills": Array of string (e.g. ["Python", "React", "Docker"]),
    "job_roles": Array of string (e.g. ["Software Engineer", "Cybersecurity Specialist"]),
    "location": Array of string (e.g. ["Bangalore", "San Francisco"]),
    "graduation_year": integer or null,
    "branch": string or null (e.g. "Computer Engineering"),
    "experience": integer or null,
    "other_requirements": Array of string (e.g. ["internship guidance", "referral"])
}

Do NOT include any commentary outside the JSON object. Output JSON only.`;

  for (const model of MODELS_TO_TRY) {
    try {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        model: model,
        temperature: 0.1,
      });

      const responseText = chatCompletion.choices[0]?.message?.content || '{}';
      const parsed = extractJsonFromText(responseText);

      if (parsed) {
        return {
          interests: Array.isArray(parsed.interests) && parsed.interests.length > 0 ? parsed.interests : offlineResult.interests,
          skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : offlineResult.skills,
          job_roles: Array.isArray(parsed.job_roles) && parsed.job_roles.length > 0 ? parsed.job_roles : offlineResult.job_roles,
          location: Array.isArray(parsed.location) ? parsed.location : offlineResult.location,
          graduation_year: parsed.graduation_year || offlineResult.graduation_year,
          branch: parsed.branch || offlineResult.branch,
          experience: parsed.experience || offlineResult.experience,
          other_requirements: Array.isArray(parsed.other_requirements) && parsed.other_requirements.length > 0 
            ? parsed.other_requirements 
            : offlineResult.other_requirements,
        };
      }
    } catch (error) {
      // Continue to next model in list
    }
  }

  return offlineResult;
}

/**
 * Generate a short explanation for why an alumnus matches the student's request.
 * @param {string} studentQuery 
 * @param {Object} alumni 
 * @returns {Promise<string>}
 */
async function generateMatchExplanation(studentQuery, alumni) {
  const defaultExplanation = `Expert in ${alumni.job_role} at ${alumni.official_company_name || alumni.company_name || 'industry leader'} with proven skills in ${alumni.skills_list || 'Software Engineering'}.`;

  const groqClient = getGroqClient();
  if (!groqClient) {
    return defaultExplanation;
  }

  for (const model of MODELS_TO_TRY) {
    try {
      const systemPrompt = `You are a concise career matching assistant. Output a single short sentence (max 20 words) explaining why this alumnus matches the student request. Do NOT include thinking tags or preambles. Output the explanation directly.`;
      const userPrompt = `Student request: "${studentQuery}"
Alumnus details:
Name: ${alumni.name}
Role: ${alumni.job_role}
Company: ${alumni.official_company_name || alumni.company_name || 'Tech Company'}
Skills: ${alumni.skills_list || ''}
Bio: ${alumni.bio || ''}

Explanation:`;

      const completion = await groqClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: model,
        max_tokens: 150,
        temperature: 0.3,
      });

      let text = completion.choices[0]?.message?.content?.trim();
      if (text) {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').replace(/^"|"$/g, '').trim();
        if (text.length > 5) {
          return text;
        }
      }
    } catch (error) {
      // Continue to next model or fallback
    }
  }

  return defaultExplanation;
}

module.exports = {
  extractQueryRequirements,
  generateMatchExplanation,
};
