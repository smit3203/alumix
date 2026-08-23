const db = require('../config/db');
const { qdrantClient, COLLECTION_NAME, VECTOR_DIMENSION, DISTANCE_METRIC } = require('../config/qdrant');
const { generateEmbedding } = require('./embedding.service');

/**
 * Ensures that the Qdrant collection exists. Creates it if missing.
 */
async function ensureCollection() {
  if (!qdrantClient) {
    console.warn('Qdrant client not initialized. Skipping collection check.');
    return false;
  }
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      console.log(`Creating Qdrant collection "${COLLECTION_NAME}"...`);
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_DIMENSION,
          distance: DISTANCE_METRIC,
        },
      });
      console.log(`Collection "${COLLECTION_NAME}" created successfully.`);
    }
    return true;
  } catch (error) {
    console.error('Error in Qdrant ensureCollection:', error.message);
    return false;
  }
}

/**
 * Constructs a consolidated text summary of an alumnus profile for semantic vector embedding.
 * @param {number} alumniId 
 * @returns {Promise<string>}
 */
async function buildAlumniSemanticDocument(alumniId) {
  // 1. Fetch Profile and Department/Company details
  const profileRes = await db.query(
    `SELECT a.*, d.name AS department_name, c.name AS company_official_name
     FROM alumni_profiles a
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN companies c ON a.company_id = c.id
     WHERE a.id = $1`,
    [alumniId]
  );

  if (profileRes.rows.length === 0) return '';
  const p = profileRes.rows[0];

  // 2. Fetch Skills
  const skillsRes = await db.query(
    `SELECT s.name FROM skills s
     JOIN alumni_skills aks ON aks.skill_id = s.id
     WHERE aks.alumni_id = $1`,
    [alumniId]
  );
  const skills = skillsRes.rows.map((r) => r.name).join(', ');

  // 3. Fetch Interests
  const interestsRes = await db.query(
    `SELECT i.name FROM interests i
     JOIN alumni_interests aki ON aki.interest_id = i.id
     WHERE aki.alumni_id = $1`,
    [alumniId]
  );
  const interests = interestsRes.rows.map((r) => r.name).join(', ');

  // 4. Fetch Career Journey
  const journeyRes = await db.query(
    `SELECT job_title, company_name, description FROM career_journeys
     WHERE alumni_id = $1 ORDER BY start_year DESC`,
    [alumniId]
  );
  const journeyStr = journeyRes.rows
    .map((j) => `${j.job_title} at ${j.company_name}: ${j.description || ''}`)
    .join('; ');

  // 5. Fetch Survey Open-Ended Responses
  const surveyRes = await db.query(
    `SELECT question_no, answer_json FROM alumni_survey_responses
     WHERE alumni_id = $1 ORDER BY question_no ASC`,
    [alumniId]
  );
  const surveyTexts = surveyRes.rows
    .map((s) => {
      const val = typeof s.answer_json === 'string' ? s.answer_json : JSON.stringify(s.answer_json);
      return `Q${s.question_no}: ${val}`;
    })
    .join(' ');

  // Build full document text
  const parts = [
    `Name: ${p.name}`,
    `Branch/Department: ${p.department_name || ''}`,
    `Graduation Year: ${p.graduation_year}`,
    `Current Role: ${p.job_role}`,
    `Company: ${p.company_official_name || p.company_name || ''}`,
    `Location: ${p.location || ''}`,
    `Bio: ${p.bio || ''}`,
    `Skills: ${skills}`,
    `Interests: ${interests}`,
    `Experience Years: ${p.experience_years}`,
    `Mentorship Available: ${p.mentorship_available ? 'Yes' : 'No'}`,
    `Referral Available: ${p.referral_available ? 'Yes' : 'No'}`,
    `Career Advice: ${p.advice_text || ''}`,
    `Career Journey Timeline: ${journeyStr}`,
    `Survey Responses & Insights: ${surveyTexts}`,
  ];

  return parts.filter(Boolean).join('\n');
}

/**
 * MANDATORY VECTOR SYNC: Reconstructs alumni document, generates embedding, and updates Qdrant.
 * @param {number} alumniId 
 */
async function syncAlumniToQdrant(alumniId) {
  try {
    const docText = await buildAlumniSemanticDocument(alumniId);
    if (!docText) return;

    const vector = await generateEmbedding(docText);

    if (!qdrantClient) {
      console.warn(`Qdrant client unavailable. Could not sync alumni ID ${alumniId} vector.`);
      return;
    }

    await ensureCollection();

    await qdrantClient.upsert(COLLECTION_NAME, {
      points: [
        {
          id: alumniId,
          vector: vector,
          payload: {
            alumni_id: alumniId,
            updated_at: new Date().toISOString(),
          },
        },
      ],
    });

    console.log(`Qdrant Vector successfully synced for Alumni ID: ${alumniId}`);
  } catch (error) {
    console.error(`Failed to sync alumni ID ${alumniId} to Qdrant:`, error.message);
  }
}

/**
 * Performs semantic similarity search against Qdrant collection.
 * @param {number[]} vector 384-dim query vector
 * @param {number} limit Maximum results
 * @returns {Promise<Array<{id: number, score: number}>>}
 */
async function searchAlumniVectors(vector, limit = 10) {
  if (!qdrantClient) {
    console.warn('Qdrant client not active. Cannot execute vector search.');
    return [];
  }
  try {
    await ensureCollection();
    const results = await qdrantClient.search(COLLECTION_NAME, {
      vector: vector,
      limit: limit,
      with_payload: true,
    });
    return results.map((r) => ({
      id: typeof r.id === 'number' ? r.id : parseInt(r.id, 10),
      score: r.score,
    }));
  } catch (error) {
    console.error('Qdrant vector search failed:', error.message);
    return [];
  }
}

module.exports = {
  ensureCollection,
  buildAlumniSemanticDocument,
  syncAlumniToQdrant,
  searchAlumniVectors,
};
