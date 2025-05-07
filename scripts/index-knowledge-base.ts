import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Settings } from '@llamaindex/core/global';
import { OpenAIEmbedding } from '@llamaindex/openai';

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');

// Set embedding model globally first
Settings.embedModel = new OpenAIEmbedding({ model: 'text-embedding-3-small', dimensions: 1536 });

// Only import vector-store after setting the embedding model
import { indexKnowledgeBase } from '../app/lib/vector-store';

(async () => {
  console.log("Starting knowledge base indexing...");
  try {
    await indexKnowledgeBase();
    console.log("Knowledge base indexing completed successfully!");
  } catch (error) {
    console.error("Error indexing knowledge base:", error);
    process.exit(1);
  }
})(); 