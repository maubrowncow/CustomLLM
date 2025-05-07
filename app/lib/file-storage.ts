import fs from 'fs';
import path from 'path';

const INSTRUCTIONS_DIR = path.join(process.cwd(), 'data', 'instructions');
const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge_base');

// Ensure directories exist
if (!fs.existsSync(INSTRUCTIONS_DIR)) {
  fs.mkdirSync(INSTRUCTIONS_DIR, { recursive: true });
}
if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
}

export async function saveInstructions(instructions: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `instructions_${timestamp}.txt`;
  const filepath = path.join(INSTRUCTIONS_DIR, filename);
  
  await fs.promises.writeFile(filepath, instructions, 'utf-8');
  
  // Also save as latest
  const latestPath = path.join(INSTRUCTIONS_DIR, 'latest.txt');
  await fs.promises.writeFile(latestPath, instructions, 'utf-8');

  // Ensure archive directory exists
  const archiveDir = path.join(INSTRUCTIONS_DIR, 'archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Move all old instructions_*.txt files (except latest.txt and the new one) to archive
  const files = await fs.promises.readdir(INSTRUCTIONS_DIR);
  await Promise.all(
    files
      .filter(f => f.startsWith('instructions_') && f !== filename && f !== 'latest.txt')
      .map(async f => {
        const oldPath = path.join(INSTRUCTIONS_DIR, f);
        const newPath = path.join(archiveDir, f);
        try {
          // Check if file exists before trying to move it
          await fs.promises.access(oldPath);
          await fs.promises.rename(oldPath, newPath);
        } catch (error: any) {
          // Skip if file doesn't exist or can't be accessed
          console.warn(`Skipping archival of ${f}: ${error?.message || 'Unknown error'}`);
        }
      })
  );
}

export async function getLatestInstructions(): Promise<string> {
  const latestPath = path.join(INSTRUCTIONS_DIR, 'latest.txt');
  try {
    return await fs.promises.readFile(latestPath, 'utf-8');
  } catch (error) {
    console.error('Error reading latest instructions:', error);
    return '';
  }
}

export async function saveKnowledgeBaseDocument(
  filename: string,
  content: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  const filepath = path.join(KNOWLEDGE_BASE_DIR, filename);
  
  // Save the document content
  await fs.promises.writeFile(filepath, content, 'utf-8');
  
  // Save metadata in a separate file
  const metadataPath = `${filepath}.meta.json`;
  await fs.promises.writeFile(
    metadataPath,
    JSON.stringify({
      ...metadata,
      savedAt: new Date().toISOString(),
      originalFilename: filename
    }, null, 2),
    'utf-8'
  );
}

export async function getKnowledgeBaseDocument(filename: string): Promise<{
  content: string;
  metadata: Record<string, any>;
}> {
  const filepath = path.join(process.cwd(), 'data', 'knowledge_base', filename);
  const metadataPath = `${filepath}.meta.json`;
  try {
    const content = await fs.promises.readFile(filepath, 'utf-8');
    let metadata = {};
    try {
      const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } catch (metaError) {
      // Metadata file missing or corrupted, fallback to empty object
      metadata = {};
    }
    return {
      content,
      metadata
    };
  } catch (error) {
    console.error(`Error reading knowledge base document ${filename} at path ${filepath}:`, error);
    throw error;
  }
}

export async function listKnowledgeBaseDocuments(): Promise<Array<{
  filename: string;
  metadata: Record<string, any>;
}>> {
  try {
    const files = await fs.promises.readdir(KNOWLEDGE_BASE_DIR);
    const documents = await Promise.all(
      files
        .filter(file => !file.endsWith('.meta.json'))
        .map(async filename => {
          const metadataPath = path.join(KNOWLEDGE_BASE_DIR, `${filename}.meta.json`);
          try {
            const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
            return {
              filename,
              metadata: JSON.parse(metadataContent)
            };
          } catch (error) {
            return {
              filename,
              metadata: { error: 'No metadata found' }
            };
          }
        })
    );
    return documents;
  } catch (error) {
    console.error('Error listing knowledge base documents:', error);
    return [];
  }
} 