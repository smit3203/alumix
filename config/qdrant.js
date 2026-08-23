const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;

let qdrantClient = null;

try {
  qdrantClient = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
    checkCompatibility: false,
  });
  console.log(`Qdrant client initialized pointing to: ${qdrantUrl}`);
} catch (error) {
  console.warn('Failed to instantiate Qdrant Client:', error.message);
}

const COLLECTION_NAME = 'alumni_vectors';
const VECTOR_DIMENSION = 384; // Standard for Xenova/all-MiniLM-L6-v2
const DISTANCE_METRIC = 'Cosine';

module.exports = {
  qdrantClient,
  COLLECTION_NAME,
  VECTOR_DIMENSION,
  DISTANCE_METRIC,
};
