import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs/promises';
import path from 'path';
import { Settings } from '@llamaindex/core/global';
import { OpenAIEmbedding } from '@llamaindex/openai';
import { addDocument } from '../app/lib/vector-store';

// Set embedding model globally first
Settings.embedModel = new OpenAIEmbedding({ model: 'text-embedding-3-small', dimensions: 1536 });

async function reindexKnowledgeBase() {
  const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
  
  try {
    console.log(`📚 Re-indexing all files in knowledge base: ${kbDir}`);
    
    // Get all files in the knowledge base directory
    const files = await fs.readdir(kbDir);
    console.log(`📂 Found ${files.length} files to index`);
    
    // Process each file
    for (const file of files) {
      const filePath = path.join(kbDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        try {
          console.log(`🔍 Processing: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
          
          // Read file content
          const content = await fs.readFile(filePath, 'utf8');
          
          // Index the file
          console.log(`📥 Indexing: ${file}`);
          await addDocument(file, content);
          console.log(`✅ Successfully indexed: ${file}`);
        } catch (error) {
          console.error(`❌ Error processing file ${file}:`, error);
        }
      }
    }
    
    console.log('🎉 Knowledge base re-indexing complete!');
  } catch (error) {
    console.error('❌ Error re-indexing knowledge base:', error);
  }
}

// Run the reindexing
reindexKnowledgeBase().catch(error => {
  console.error('❌ Top-level error:', error);
  process.exit(1);
}); 