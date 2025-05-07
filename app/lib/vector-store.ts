// Vector store implementation using LlamaIndex

import fs from 'fs/promises';
import path from 'path';
import { Document, MetadataMode } from '@llamaindex/core/schema';
import { SimpleVectorStore } from 'llamaindex/vector-store';
import { VectorStoreQueryMode } from '@llamaindex/core/vector-store';
import { Settings } from '@llamaindex/core/global';
import { OpenAIEmbedding } from '@llamaindex/openai';

// Create an embedding model instance that we'll use directly
const embeddingModel = new OpenAIEmbedding({ model: 'text-embedding-3-small', dimensions: 1536 });

// Helper function to ensure embedding model is set globally
function ensureEmbeddingModel() {
  Settings.embedModel = embeddingModel;
  console.log('Embedding model set in Settings');
}

let vectorStore: SimpleVectorStore | null = null;

// Helper: Chunk text by paragraphs (double newlines)
function chunkText(text: string, chunkSize: number = 800): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > chunkSize && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export async function initializeVectorStore() {
  ensureEmbeddingModel();
  if (!vectorStore) {
    const persistDir = path.join(process.cwd(), 'data', 'vector_store');
    await fs.mkdir(persistDir, { recursive: true });
    vectorStore = await SimpleVectorStore.fromPersistDir(persistDir, embeddingModel);
  }
  return vectorStore;
}

// Index all files in the knowledge base directory
export async function indexKnowledgeBase() {
  ensureEmbeddingModel();
  const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
  
  try {
    const files = await fs.readdir(kbDir);
    const store = await initializeVectorStore();
    
    for (const file of files) {
      const filePath = path.join(kbDir, file);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      
      console.log(`Processing ${file}...`);
      const content = await fs.readFile(filePath, 'utf8');
      const chunks = chunkText(content);
      console.log(`Indexing ${file} with ${chunks.length} chunks`);
      
      // Create documents with pre-computed embeddings
      const docs = [];
      for (const chunk of chunks) {
        try {
          const embedding = await embeddingModel.getTextEmbedding(chunk);
          const doc = new Document({
            text: chunk,
            metadata: { filename: file },
            embedding: embedding
          });
          docs.push(doc);
        } catch (err) {
          console.error(`Error embedding chunk: ${err}`);
        }
      }
      
      console.log(`Adding ${docs.length} documents to vector store`);
      await store.add(docs);
      console.log(`Successfully added documents from ${file}`);
    }
    
    await store.persist();
    console.log("Knowledge base indexed successfully");
    return true;
  } catch (error) {
    console.error("Error in indexKnowledgeBase:", error);
    throw error;
  }
}

export async function addDocument(filePath: string, content: string) {
  ensureEmbeddingModel();
  const store = await initializeVectorStore();
  const chunks = chunkText(content);
  
  const docs = [];
  for (const chunk of chunks) {
    const embedding = await embeddingModel.getTextEmbedding(chunk);
    const doc = new Document({ 
      text: chunk, 
      metadata: { filePath },
      embedding: embedding
    });
    docs.push(doc);
  }
  
  await store.add(docs);
  await store.persist();
}

export async function similaritySearch(query: string, k: number = 5) {
  ensureEmbeddingModel();
  const store = await initializeVectorStore();
  
  // Get embedding for query
  const queryEmbedding = await embeddingModel.getTextEmbedding(query);
  
  const results = await store.query({
    queryEmbedding: queryEmbedding,
    queryStr: query,
    similarityTopK: k,
    mode: VectorStoreQueryMode.DEFAULT
  });
  
  return results.nodes?.map(node => ({
    text: node.getContent(MetadataMode.ALL),
    metadata: node.metadata || {}
  })) || [];
}

export async function deleteDocument(filePath: string) {
  ensureEmbeddingModel();
  const store = await initializeVectorStore();
  await store.delete(filePath);
  await store.persist();
}

/**
 * Search specifically for author quotes in the knowledge base
 * This function is optimized to find authors and their quotes
 */
export async function searchAuthorsAndQuotes(k: number = 10) {
  ensureEmbeddingModel();
  const store = await initializeVectorStore();
  
  // Use author-specific queries for better retrieval
  const authorQueries = [
    "list all authors",
    "author quotes",
    "who are the authors",
    "relevant author quotes",
    "casper ter kuile quote",
    "will storr quote",
    "simone stolzoff quote",
    "franklin veaux quote",
    "jason fried quote"
  ];
  
  // Collect all unique results
  const allResults = new Map();
  
  for (const query of authorQueries) {
    console.log(`Searching for: ${query}`);
    const queryEmbedding = await embeddingModel.getTextEmbedding(query);
    
    const results = await store.query({
      queryEmbedding: queryEmbedding,
      queryStr: query,
      similarityTopK: k,
      mode: VectorStoreQueryMode.DEFAULT
    });
    
    if (results.nodes) {
      for (const node of results.nodes) {
        // Use node ID as key to avoid duplicates
        if (!allResults.has(node.id_)) {
          allResults.set(node.id_, {
            text: node.getContent(MetadataMode.ALL),
            metadata: node.metadata || {}
          });
        }
      }
    }
  }
  
  console.log(`Found ${allResults.size} unique author/quote entries`);
  return Array.from(allResults.values());
}

// Do NOT auto-index on module load. Call indexKnowledgeBase() explicitly from a setup script or server entry.
// indexKnowledgeBase().catch(e => console.error('Error indexing knowledge base:', e));
