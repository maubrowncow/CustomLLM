import { NextResponse } from 'next/server';
import { 
  saveKnowledgeBaseDocument, 
  getKnowledgeBaseDocument,
  listKnowledgeBaseDocuments 
} from "@/app/lib/file-storage";
import { addDocument } from "@/app/lib/vector-store";
import path from 'path';
import fs from 'fs/promises';

/**
 * Documents API to retrieve and analyze full document content
 * 
 * Query parameters:
 * - document: document name to retrieve (supports partial matching)
 * - episodeNumber: filter by episode number for transcripts
 * - analyze: set to 'true' to enable content analysis
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const document = url.searchParams.get('document') || '';
    const episodeNumber = url.searchParams.get('episodeNumber');
    const analyze = url.searchParams.get('analyze') === 'true';
    const filename = url.searchParams.get('filename');
    
    // If no specific params are provided, list all documents
    if (!document && !episodeNumber && !filename) {
      // List all documents with correct metadata
      const files = await fs.readdir(path.join(process.cwd(), 'data', 'knowledge_base'));
      const documents = await Promise.all(
        files.filter(file => !file.endsWith('.meta.json')).map(async (file) => {
          const filePath = path.join(process.cwd(), 'data', 'knowledge_base', file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            type: file.split('.').pop() || 'Unknown',
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
          };
        })
      );
      return NextResponse.json({ documents });
    }
    
    // Retrieve specific document by filename
    if (filename) {
      const filePath = path.join(process.cwd(), 'data', 'knowledge_base', filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const stats = await fs.stat(filePath);
        return NextResponse.json({
          name: filename,
          content,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        });
      } catch (error) {
        return NextResponse.json(
          { error: `File not found: ${filename}` },
          { status: 404 }
        );
      }
    }
    
    // Original document analysis code
    console.log(`API: Retrieving document${document ? `: ${document}` : episodeNumber ? ` for episode: ${episodeNumber}` : ''}`);
    
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    let filesToCheck: string[] = [];
    
    // Get all files from knowledge base
    const allFiles = await fs.readdir(kbDir);
    
    // Apply document filter if specified
    if (document) {
      filesToCheck = allFiles.filter(file => 
        file.toLowerCase().includes(document.toLowerCase())
      );
      console.log(`Filtered to ${filesToCheck.length} files matching "${document}"`);
    } 
    // Apply episode number filter if specified
    else if (episodeNumber) {
      const paddedNumber = episodeNumber.padStart(3, '0');
      const pattern = `E${paddedNumber}`;
      filesToCheck = allFiles.filter(file => 
        file.includes(pattern)
      );
      console.log(`Filtered to ${filesToCheck.length} files matching episode ${episodeNumber}`);
    }
    
    if (filesToCheck.length === 0) {
      return NextResponse.json(
        { error: 'No matching files found' },
        { status: 404 }
      );
    }
    
    // Process first matching file
    const file = filesToCheck[0];
    const filePath = path.join(kbDir, file);
    const stat = await fs.stat(filePath);
    
    if (!stat.isFile()) {
      return NextResponse.json(
        { error: 'Selected path is not a file' },
        { status: 400 }
      );
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    
    // Basic file metadata
    const response: any = {
      file,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      content
    };
    
    // Content analysis if requested
    if (analyze) {
      console.log(`Analyzing content for ${file}`);
      
      // Extract topics and terms
      const lines = content.split('\n');
      const topics: Record<string, any> = {};
      
      // Determine document type based on extension and content patterns
      const isMarkdown = file.toLowerCase().endsWith('.md') || content.includes('# ');
      const isTranscript = file.toLowerCase().includes('transcript') || content.match(/\[\d+:\d+:\d+\]/);
      
      console.log(`📄 Document type: ${isMarkdown ? 'Markdown' : isTranscript ? 'Transcript' : 'Text'}`);
      
      // Different analysis based on file type
      if (isTranscript) {
        // Extract timestamps and content blocks for transcripts
        const timeBlocks = [];
        let currentBlock = { timestamp: '', text: [] as string[] };
        
        for (const line of lines) {
          // Extract timestamps (format: [0:12:34])
          const timestampMatch = line.match(/\[(\d+:\d+:\d+)\]/);
          if (timestampMatch) {
            // Save previous block if it has content
            if (currentBlock.timestamp && currentBlock.text.length > 0) {
              timeBlocks.push({...currentBlock});
            }
            // Start new block
            currentBlock = { 
              timestamp: timestampMatch[1], 
              text: [line.replace(timestampMatch[0], '').trim()] 
            };
          } else if (line.trim() && currentBlock.timestamp) {
            // Add line to current block
            currentBlock.text.push(line.trim());
          }
        }
        
        // Add the last block if it has content
        if (currentBlock.timestamp && currentBlock.text.length > 0) {
          timeBlocks.push(currentBlock);
        }
        
        // Extract top terms and their frequencies
        const termFrequency: Record<string, number> = {};
        const words = content.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        
        for (const word of words) {
          if (!['the', 'and', 'for', 'that', 'this', 'with', 'you', 'have', 'are', 'what', 
                'was', 'from', 'they', 'like', 'your', 'just', 'but', 'not', 'its'].includes(word)) {
            termFrequency[word] = (termFrequency[word] || 0) + 1;
          }
        }
        
        // Get top terms
        const topTerms = Object.entries(termFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map(([term, count]) => ({ term, count }));

        // Extract main topics from the transcript using frequency and proximity analysis
        const mainTopics: {title: string, timestamp: string, summary: string}[] = [];
        
        // Look for significant topic changes and discussions
        if (timeBlocks.length > 0) {
          // Create a frequency map of terms in each block
          const blockSignificance = timeBlocks.map((block, idx) => {
            const blockText = block.text.join(' ').toLowerCase();
            const significance = topTerms.reduce((score, term) => {
              if (blockText.includes(term.term)) {
                return score + term.count;
              }
              return score;
            }, 0);
            return { index: idx, significance, timestamp: block.timestamp };
          });
          
          // Sort by significance
          blockSignificance.sort((a, b) => b.significance - a.significance);
          
          // Take top significant blocks and restore original order
          const topBlocks = blockSignificance
            .slice(0, Math.min(8, blockSignificance.length))
            .sort((a, b) => a.index - b.index);
          
          // Create topic summaries from these blocks
          for (const block of topBlocks) {
            const blockData = timeBlocks[block.index];
            const blockText = blockData.text.join(' ');
            
            // Generate a title based on key terms in the block
            const blockTerms = new Set<string>();
            for (const term of topTerms) {
              if (blockText.toLowerCase().includes(term.term) && 
                  !['yeah', 'like', 'just', 'know', 'right', 'think'].includes(term.term)) {
                blockTerms.add(term.term);
                if (blockTerms.size >= 3) break;
              }
            }
            
            // Create a topic title and summary
            const title = Array.from(blockTerms).join(', ');
            const summary = blockText.length > 120 ? blockText.substring(0, 120) + '...' : blockText;
            
            if (title) {
              mainTopics.push({
                title: title.charAt(0).toUpperCase() + title.slice(1),
                timestamp: blockData.timestamp,
                summary
              });
            }
          }
        }
        
        // Add transcript analysis to response
        response.analysis = {
          type: 'transcript',
          lineCount: lines.length,
          timeBlocks: timeBlocks.length,
          blocks: timeBlocks.slice(0, 50), // Limit to first 50 blocks
          topTerms,
          wordCount: words.length,
          mainTopics
        };
      } 
      else if (isMarkdown) {
        // Extract sections and content from markdown files
        const sections = [];
        let currentSection = { title: '', level: 0, content: [] as string[] };
        
        for (const line of lines) {
          // Extract headers
          const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
          if (headerMatch) {
            // Save previous section if it has content
            if (currentSection.title && currentSection.content.length > 0) {
              sections.push({...currentSection});
            }
            
            // Start new section
            currentSection = {
              title: headerMatch[2].trim(),
              level: headerMatch[1].length,
              content: []
            };
          } else if (line.trim()) {
            // Add non-empty line to current section
            currentSection.content.push(line.trim());
          }
        }
        
        // Add the last section if it has content
        if (currentSection.title && currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        
        // Extract quotes (text within ** or * or between quotes)
        const quotes: string[] = [];
        const quoteRegex = /(\*\*.*?\*\*|\*.*?\*|".*?"|'.*?')/g;
        let match;
        const fullText = content.replace(/\n/g, ' ');
        
        while ((match = quoteRegex.exec(fullText)) !== null) {
          const quote = match[0].replace(/\*\*|\*|"|'/g, '').trim();
          if (quote.length > 10 && !quotes.includes(quote)) {
            quotes.push(quote);
          }
        }
        
        // Find authors and references
        const authors: string[] = [];
        const authorRegex = /\*\*([^*]+?)(?:,|\*\*)|by\s+([A-Z][a-zA-Z ]+)/g;
        while ((match = authorRegex.exec(content)) !== null) {
          const author = (match[1] || match[2]).trim();
          if (author && !authors.includes(author)) {
            authors.push(author);
          }
        }
        
        // Extract key points and concepts
        const keyPoints: {title: string, content: string}[] = [];
        sections.forEach(section => {
          // Headers with specific keywords indicate important sections
          if (/strategic|plan|phase|goal|action|gtm|market|author|quote|relevant/i.test(section.title)) {
            keyPoints.push({
              title: section.title,
              content: section.content.join(' ').substring(0, 200) + '...'
            });
          }
          
          // Bullet points often contain key information
          section.content.forEach(line => {
            if (/^[•✅📊📢🎥✍️🎤🧩👑📰🗣️🎉💬🏠🧠]\s+/.test(line)) {
              keyPoints.push({
                title: section.title,
                content: line
              });
            }
          });
        });
        
        // Add markdown analysis to response
        response.analysis = {
          type: 'markdown',
          sections: sections.map(s => ({ title: s.title, level: s.level })),
          authors,
          quotes: quotes.slice(0, 10),
          keyPoints,
          fullSections: sections.slice(0, 10)
        };
      }
      else {
        // Generic text analysis for other file types
        // Extract top terms and their frequencies
        const termFrequency: Record<string, number> = {};
        const words = content.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        
        for (const word of words) {
          if (!['the', 'and', 'for', 'that', 'this', 'with', 'you', 'have', 'are', 'what'].includes(word)) {
            termFrequency[word] = (termFrequency[word] || 0) + 1;
          }
        }
        
        // Get top terms
        const topTerms = Object.entries(termFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([term, count]) => ({ term, count }));
          
        // Basic analysis for generic text
        response.analysis = {
          type: 'text',
          lineCount: lines.length,
          wordCount: words.length,
          topTerms
        };
      }
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing document request:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve document' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }
    const filePath = path.join(process.cwd(), 'data', 'knowledge_base', filename);
    await fs.unlink(filePath);
    // Also delete metadata file if it exists
    const metadataPath = `${filePath}.meta.json`;
    try { await fs.unlink(metadataPath); } catch {}
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { filename, content, metadata } = await req.json();

    if (!filename || !content) {
      return NextResponse.json(
        { error: "Filename and content are required" },
        { status: 400 }
      );
    }

    // Save to file system
    await saveKnowledgeBaseDocument(filename, content, metadata);

    // Add to vector store
    await addDocument(content, {
      ...metadata,
      filename,
      savedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving document:", error);
    return NextResponse.json(
      { error: "Failed to save document" },
      { status: 500 }
    );
  }
} 