import fs from 'fs/promises';
import path from 'path';

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
  return filePath;
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