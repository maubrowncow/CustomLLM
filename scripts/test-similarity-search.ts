import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Settings } from '@llamaindex/core/global';
import { OpenAIEmbedding } from '@llamaindex/openai';

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);

Settings.embedModel = new OpenAIEmbedding({ model: 'text-embedding-3-small', dimensions: 1536 });

(async () => {
  const { similaritySearch, indexKnowledgeBase } = await import('../app/lib/vector-store');
  await indexKnowledgeBase();
  const query = 'Who are the authors in the knowledge base?';
  const results = await similaritySearch(query);
  console.log('Results:', results);
})(); 