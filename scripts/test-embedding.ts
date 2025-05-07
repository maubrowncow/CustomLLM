import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Settings } from '@llamaindex/core/global';
import { OpenAIEmbedding } from '@llamaindex/openai';

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);

Settings.embedModel = new OpenAIEmbedding({ model: 'text-embedding-3-small', dimensions: 1536 });

(async () => {
  const embedding = await Settings.embedModel.getTextEmbedding('test string');
  console.log('Embedding:', embedding);
})(); 