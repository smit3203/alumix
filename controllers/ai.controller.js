const db = require('../config/db');
const aiService = require('../services/ai.service');
const embeddingService = require('../services/embedding.service');
const qdrantService = require('../services/qdrant.service');

/**
 * Render AI Finder Page
 */
exports.getAiFinder = (req, res) => {
  res.render('ai/finder', {
    title: 'AI Finder - Semantic Alumni Match',
    results: null,
    query: '',
    extractedParams: null,
    error: null,
  });
};

/**
 * Search AI Finder Pipeline
 */
exports.postAiSearch = async (req, res) => {
  const { query } = req.body;

  if (!query || !query.trim()) {
    return res.render('ai/finder', {
      title: 'AI Finder - Semantic Alumni Match',
      results: null,
      query: '',
      extractedParams: null,
      error: 'Please enter a description of what kind of alumni you are looking for.',
    });
  }

  try {
    // Step 1: Send query to Groq LLM to extract JSON parameters
    const extracted = await aiService.extractQueryRequirements(query.trim());

    // Step 2: Generate Embedding vector (384 dimensions)
    const queryVector = await embeddingService.generateEmbedding(query.trim());

    // Step 3: Query Qdrant vector database for top matching IDs
    const vectorMatches = await qdrantService.searchAlumniVectors(queryVector, 10);

    let matchingAlumniIds = vectorMatches.map((m) => m.id);
    const scoreMap = {};
    vectorMatches.forEach((m) => {
      scoreMap[m.id] = m.score;
    });

    // If no alumni exceed the semantic relevance threshold, return empty results (renders clean empty state)
    if (matchingAlumniIds.length === 0) {
      return res.render('ai/finder', {
        title: 'AI Finder - Semantic Alumni Match',
        results: [],
        query: query.trim(),
        extractedParams: extracted,
        error: null,
      });
    }

    // Step 4: Fetch complete alumni records from PostgreSQL source of truth
    const placeholders = matchingAlumniIds.map((_, i) => `$${i + 1}`).join(', ');
    const alumniRecordsRes = await db.query(
      `SELECT a.id, a.name, a.graduation_year, a.job_role, a.location, a.company_name,
              a.bio, a.mentorship_available, a.referral_available, a.experience_years,
              d.name AS department_name, c.name AS official_company_name,
              STRING_AGG(DISTINCT s.name, ', ') AS skills_list
       FROM alumni_profiles a
       LEFT JOIN departments d ON a.department_id = d.id
       LEFT JOIN companies c ON a.company_id = c.id
       LEFT JOIN alumni_skills aks ON a.id = aks.alumni_id
       LEFT JOIN skills s ON aks.skill_id = s.id
       WHERE a.id IN (${placeholders})
       GROUP BY a.id, d.name, c.name`,
      matchingAlumniIds
    );

    let results = alumniRecordsRes.rows;

    // Step 5: Compute dynamic match scores and generate Groq explanations
    results = await Promise.all(
      results.map(async (alumnus) => {
        const cosineSim = scoreMap[alumnus.id] || 0.25;
        // Scale cosine similarity (0.15 to 0.60) into a realistic match score (50% to 92%)
        let calculatedScore = Math.min(0.90, Math.max(0.50, 0.40 + (cosineSim * 1.1)));
        
        // Boost score if extracted structured parameters match
        let structuredBoost = 0;
        if (extracted.job_roles && extracted.job_roles.some((role) => alumnus.job_role.toLowerCase().includes(role.toLowerCase()))) {
          structuredBoost += 0.10;
        }
        if (extracted.interests && extracted.interests.some((int) => (alumnus.bio || '').toLowerCase().includes(int.toLowerCase()))) {
          structuredBoost += 0.08;
        }

        const matchPercentage = Math.min(99, Math.round((calculatedScore + structuredBoost) * 100));

        // Generate short rationale via Groq
        const explanation = await aiService.generateMatchExplanation(query.trim(), alumnus);

        return {
          ...alumnus,
          matchScore: matchPercentage,
          rawScore: cosineSim,
          whyMatched: explanation,
        };
      })
    );

    // Sort descending by relevance score
    results.sort((a, b) => b.matchScore - a.matchScore);

    res.render('ai/finder', {
      title: 'AI Finder - Semantic Alumni Match',
      results,
      query: query.trim(),
      extractedParams: extracted,
      error: null,
    });
  } catch (error) {
    console.error('Error executing AI Finder search:', error);
    res.render('ai/finder', {
      title: 'AI Finder - Semantic Alumni Match',
      results: null,
      query: query.trim(),
      extractedParams: null,
      error: 'AI Finder service encountered an unexpected error: ' + error.message,
    });
  }
};
