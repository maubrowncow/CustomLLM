import { OpenAIEmbedding, Document, VectorStoreIndex, storageContextFromDefaults, StorageContext, MetadataMode } from "llamaindex";
import fs from 'fs/promises';
import path from 'path';

// Configuration types
interface VectorStoreConfig {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  searchThreshold: number;
  maxResults: number;
}

interface DocumentMetadata {
  source?: string;
  timestamp?: string;
  [key: string]: any;
}

interface SearchResult {
  text: string;
  score: number;
  metadata?: DocumentMetadata;
}

// Default configuration
const DEFAULT_CONFIG: VectorStoreConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  embeddingModel: "text-embedding-3-small",
  searchThreshold: 0.5, // Lower threshold for better recall
  maxResults: 10 // Increase max results
};

// Initialize OpenAI embedding model
const embeddingModel = new OpenAIEmbedding({
  apiKey: process.env.OPENAI_API_KEY,
  model: DEFAULT_CONFIG.embeddingModel
});

let vectorStore: VectorStoreIndex | null = null;
let storageContext: StorageContext | null = null;

// Load documents from knowledge base directory
async function loadDocumentsFromKnowledgeBase(): Promise<Document[]> {
  const knowledgeBaseDir = path.join(process.cwd(), 'data', 'knowledge_base');
  const documents: Document[] = [];

  try {
    console.log('Loading documents from:', knowledgeBaseDir);
    const files = await fs.readdir(knowledgeBaseDir);
    console.log('Found files:', files);
    
    for (const file of files) {
      if (file.endsWith('.meta.json')) continue;
      
      const filePath = path.join(knowledgeBaseDir, file);
      console.log('Loading file:', filePath);
      
      const content = await fs.readFile(filePath, 'utf-8');
      console.log(`Loaded ${file} (${content.length} bytes)`);
      
      documents.push(new Document({
        text: content,
        metadata: {
          source: file,
          timestamp: new Date().toISOString()
        }
      }));
    }
    
    console.log(`Loaded ${documents.length} documents`);
  } catch (error) {
    console.error('Error loading documents from knowledge base:', error);
    throw error; // Re-throw to handle in caller
  }

  return documents;
}

// Initialize vector store
async function initializeVectorStore(): Promise<VectorStoreIndex> {
  if (vectorStore) {
    console.log('Using existing vector store');
    return vectorStore;
  }
  
  console.log('Initializing new vector store');
  
  if (!storageContext) {
    console.log('Creating storage context');
    storageContext = await storageContextFromDefaults({ persistDir: "./storage" });
  }
  
  // Load existing documents
  console.log('Loading documents from knowledge base');
  const documents = await loadDocumentsFromKnowledgeBase();
  
  if (documents.length === 0) {
    console.warn('No documents found in knowledge base');
  }
  
  console.log('Creating vector store with documents');
  vectorStore = await VectorStoreIndex.fromDocuments(documents, {
    storageContext
  });
  
  console.log('Vector store initialized');
  return vectorStore;
}

// Add documents to vector store
export async function addDocuments(text: string, metadata: DocumentMetadata = {}) {
  try {
    const store = await initializeVectorStore();
    const document = new Document({
      text,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('Adding document to vector store');
    await store.insert(document);
    console.log('Document added successfully');
    return true;
  } catch (error) {
    console.error("Error adding documents:", error);
    throw new Error("Failed to add documents to vector store");
  }
}

// Search for similar documents
export async function similaritySearch(
  query: string,
  config: Partial<VectorStoreConfig> = {}
): Promise<SearchResult[]> {
  try {
    console.log('Performing similarity search for:', query);
    const store = await initializeVectorStore();
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    const retriever = store.asRetriever();
    retriever.similarityTopK = finalConfig.maxResults;
    
    console.log('Retrieving results');
    const results = await retriever.retrieve(query);
    console.log(`Found ${results.length} results`);
    
    const processedResults = results
      .map(result => ({
        text: result.node.getContent(MetadataMode.NONE),
        score: result.score || 0,
        metadata: result.node.metadata as DocumentMetadata
      }))
      .filter(result => result.score >= finalConfig.searchThreshold);
    
    console.log(`Returning ${processedResults.length} results after threshold filtering`);
    return processedResults;
  } catch (error) {
    console.error("Error performing similarity search:", error);
    throw new Error("Failed to perform similarity search");
  }
}

// Additional utility functions for document management
export async function deleteDocument(documentId: string): Promise<void> {
  try {
    const store = await initializeVectorStore();
    // Note: LlamaIndex doesn't support direct node deletion
    // We'll need to implement a different approach for document deletion
    console.log(`Document deletion not supported: ${documentId}`);
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
}

export async function updateDocument(
  documentId: string,
  text: string,
  metadata: Partial<DocumentMetadata>
): Promise<void> {
  try {
    const store = await initializeVectorStore();
    const document = new Document({
      text,
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString()
      }
    });
    
    // Note: LlamaIndex doesn't support direct node updates
    // We'll need to implement a different approach for document updates
    console.log(`Document update not supported: ${documentId}`);
  } catch (error) {
    console.error("Error updating document:", error);
    throw error;
  }
}
