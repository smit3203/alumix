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

  const rawQuery = query.trim();

  try {
    // Step 1: Send query to Groq LLM / Keyword Extractor to extract structured parameters
    const extracted = await aiService.extractQueryRequirements(rawQuery);

    // Step 2: Generate Embedding vector (384 dimensions)
    let queryVector = [];
    try {
      queryVector = await embeddingService.generateEmbedding(rawQuery);
    } catch (e) {
      console.warn('Vector embedding generation skipped:', e.message);
    }

    // Step 3: Query Qdrant vector database or local vector store
    let vectorMatches = [];
    if (queryVector && queryVector.length === 384 && queryVector.some(v => v !== 0)) {
      try {
        vectorMatches = await qdrantService.searchAlumniVectors(queryVector, 10);
      } catch (vecErr) {
        console.warn('Vector search warning:', vecErr.message);
      }
    }

    let matchingAlumniIds = vectorMatches.map((m) => m.id);
    const scoreMap = {};
    vectorMatches.forEach((m) => {
      scoreMap[m.id] = m.score;
    });

    let results = [];

    // Step 4: If Vector Matches Found, fetch those specific alumni
    if (matchingAlumniIds.length > 0) {
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
      results = alumniRecordsRes.rows;
    }

    // Step 5: HYBRID FALLBACK - If vector matching returned no results, perform intelligent multi-attribute SQL search
    if (results.length === 0) {
      const allAlumniRes = await db.query(
        `SELECT a.id, a.name, a.graduation_year, a.job_role, a.location, a.company_name,
                a.bio, a.mentorship_available, a.referral_available, a.experience_years, a.advice_text,
                d.name AS department_name, c.name AS official_company_name,
                STRING_AGG(DISTINCT s.name, ', ') AS skills_list
         FROM alumni_profiles a
         LEFT JOIN departments d ON a.department_id = d.id
         LEFT JOIN companies c ON a.company_id = c.id
         LEFT JOIN alumni_skills aks ON a.id = aks.alumni_id
         LEFT JOIN skills s ON aks.skill_id = s.id
         GROUP BY a.id, d.name, c.name`
      );

      const queryWords = rawQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const scoredCandidates = [];

      for (const alumnus of allAlumniRes.rows) {
        let matchScore = 0;
        const searchableText = `${alumnus.name} ${alumnus.job_role} ${alumnus.company_name} ${alumnus.official_company_name || ''} ${alumnus.skills_list || ''} ${alumnus.bio || ''} ${alumnus.advice_text || ''} ${alumnus.department_name || ''}`.toLowerCase();

        // 1. Check extracted structured skills
        if (extracted.skills && extracted.skills.length > 0) {
          for (const sk of extracted.skills) {
            if (searchableText.includes(sk.toLowerCase())) matchScore += 25;
          }
        }

        // 2. Check extracted job roles
        if (extracted.job_roles && extracted.job_roles.length > 0) {
          for (const jr of extracted.job_roles) {
            if (searchableText.includes(jr.toLowerCase())) matchScore += 30;
          }
        }

        // 3. Check extracted interests
        if (extracted.interests && extracted.interests.length > 0) {
          for (const intr of extracted.interests) {
            if (searchableText.includes(intr.toLowerCase())) matchScore += 15;
          }
        }

        // 4. Check word tokens from student query
        for (const w of queryWords) {
          if (searchableText.includes(w)) matchScore += 8;
        }

        // 5. Check other requirements (e.g. mentorship / referrals)
        if (rawQuery.toLowerCase().includes('mentor') && alumnus.mentorship_available) matchScore += 10;
        if (rawQuery.toLowerCase().includes('referral') && alumnus.referral_available) matchScore += 10;

        if (matchScore > 0) {
          // Normalize score to percentage (60% to 96%)
          const percentage = Math.min(96, Math.max(62, 50 + Math.round(matchScore * 0.6)));
          scoredCandidates.push({
            alumnus,
            calculatedScore: percentage,
          });
        }
      }

      scoredCandidates.sort((a, b) => b.calculatedScore - a.calculatedScore);
      results = scoredCandidates.slice(0, 10).map(c => {
        scoreMap[c.alumnus.id] = c.calculatedScore / 100;
        return c.alumnus;
      });
    }

    // Step 6: Compute final presentation cards and generate explanations
    if (results.length > 0) {
      results = await Promise.all(
        results.map(async (alumnus) => {
          const rawCosine = scoreMap[alumnus.id] || 0.35;
          let matchPercentage;

          if (rawCosine > 1) {
            matchPercentage = Math.round(rawCosine);
          } else {
            let baseScore = Math.min(0.90, Math.max(0.55, 0.45 + (rawCosine * 1.0)));
            let structuredBoost = 0;
            if (extracted.job_roles && extracted.job_roles.some((role) => alumnus.job_role.toLowerCase().includes(role.toLowerCase()))) {
              structuredBoost += 0.10;
            }
            if (extracted.skills && extracted.skills.some((sk) => (alumnus.skills_list || '').toLowerCase().includes(sk.toLowerCase()))) {
              structuredBoost += 0.08;
            }
            matchPercentage = Math.min(98, Math.round((baseScore + structuredBoost) * 100));
          }

          const explanation = await aiService.generateMatchExplanation(rawQuery, alumnus);

          return {
            ...alumnus,
            matchScore: matchPercentage,
            rawScore: rawCosine,
            whyMatched: explanation,
          };
        })
      );

      // Sort descending by relevance score
      results.sort((a, b) => b.matchScore - a.matchScore);
    }

    res.render('ai/finder', {
      title: 'AI Finder - Semantic Alumni Match',
      results,
      query: rawQuery,
      extractedParams: extracted,
      error: null,
    });
  } catch (error) {
    console.error('Error executing AI Finder search:', error);
    res.render('ai/finder', {
      title: 'AI Finder - Semantic Alumni Match',
      results: null,
      query: rawQuery,
      extractedParams: null,
      error: 'AI Finder service encountered an unexpected error: ' + error.message,
    });
  }
};
