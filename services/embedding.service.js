require('dotenv').config();

let pipelinePromise = null;

async function getExtractor() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      try {
        const { pipeline } = await import('@xenova/transformers');
        const modelName = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
        console.log(`Loading embedding model: ${modelName}...`);
        const extractor = await pipeline('feature-extraction', modelName);
        console.log(`Embedding model ${modelName} loaded successfully.`);
        return extractor;
      } catch (err) {
        console.error('Error initializing @xenova/transformers pipeline:', err.message);
        throw err;
      }
    })();
  }
  return pipelinePromise;
}

/**
 * Generate a 384-dimensional vector embedding for input text.
 * @param {string} text 
 * @returns {Promise<number[]>} Array of 384 floating point numbers
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return new Array(384).fill(0);
  }

  try {
    const extractor = await getExtractor();
    const output = await extractor(text.trim(), { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('Failed to generate embedding:', error.message);
    // Return dummy zero vector fallback if embedding fails
    return new Array(384).fill(0);
  }
}

module.exports = {
  generateEmbedding,
};
