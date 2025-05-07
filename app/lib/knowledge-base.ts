import fs from 'fs/promises';
import path from 'path';
import { addDocument } from './vector-store'; // Import the addDocument function

const knowledgeBasePath = path.join(process.cwd(), 'data', 'knowledge_base');

export async function ensureKnowledgeBaseExists() {
  try {
    await fs.access(knowledgeBasePath);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(knowledgeBasePath, { recursive: true });
  }
}

export async function getKnowledgeBaseStats() {
  try {
    const stats = await fs.stat(knowledgeBasePath);
    return {
      exists: true,
      size: stats.size,
      lastModified: stats.mtime,
    };
  } catch {
    return {
      exists: false,
      size: 0,
      lastModified: null,
    };
  }
}

export async function listKnowledgeBaseFiles() {
  const files: string[] = [];
  
  async function scanDirectory(dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (!entry.name.endsWith('.meta.json')) {
        files.push(fullPath);
      }
    }
  }
  
  await scanDirectory(knowledgeBasePath);
  return files;
}

export async function saveFile(fileName: string, content: Buffer) {
  const filePath = path.join(knowledgeBasePath, fileName);
  await fs.writeFile(filePath, content);
  
  // Try to index the file if it's a text file
  try {
    const fileContent = content.toString('utf-8'); // Try to convert buffer to string
    
    // Simple check if it looks like a text file (not binary)
    if (isTextFile(fileName) && fileContent.length > 0) {
      console.log(`📚 Indexing new file: ${fileName}`);
      await addDocument(fileName, fileContent);
      console.log(`✅ Successfully indexed: ${fileName}`);
    } else {
      console.log(`⚠️ Not indexing non-text file: ${fileName}`);
    }
  } catch (error) {
    console.error(`Error indexing file ${fileName}:`, error);
    // Continue even if indexing fails - the file was still saved
  }
  
  return filePath;
}

// Helper to check if a file is likely a text file based on extension
function isTextFile(fileName: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.html', '.htm', '.xml', '.json', '.csv', 
    '.yaml', '.yml', '.js', '.ts', '.jsx', '.tsx', '.css', 
    '.scss', '.less', '.py', '.rb', '.java', '.c', '.cpp', 
    '.h', '.php', '.sh', '.bat', '.ps1', '.log', '.conf'
  ];
  
  const ext = path.extname(fileName).toLowerCase();
  return textExtensions.includes(ext);
}

export async function deleteFile(filePath: string) {
  const fullPath = path.join(knowledgeBasePath, filePath);
  await fs.unlink(fullPath);
  
  // Also delete metadata file if it exists
  const metadataPath = `${fullPath}.meta.json`;
  try {
    await fs.unlink(metadataPath);
  } catch (error) {
    // Ignore error if metadata file doesn't exist
  }
} 