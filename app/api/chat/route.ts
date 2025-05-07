import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { similaritySearch, indexKnowledgeBase, searchAuthorsAndQuotes } from '@/app/lib/vector-store';
import { getLatestInstructions } from '@/app/lib/file-storage';
import { Settings } from '@llamaindex/core/global';
import { OpenAIEmbedding } from '@llamaindex/openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables explicitly
dotenv.config({ path: '.env.local' });

// Set embedding model for LlamaIndex at the very top
Settings.embedModel = new OpenAIEmbedding({ model: 'text-embedding-3-small', dimensions: 1536 });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to directly extract the author quotes section from the Digg GTM file
async function extractAuthorQuotes() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'knowledge_base', 'Digg GTM.md');
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract the Relevant Author Quotes section
    const quotesMatch = content.match(/## Relevant Author Quotes([\s\S]*?)(?=---)/);
    if (quotesMatch && quotesMatch[1]) {
      return quotesMatch[1].trim();
    }
    return null;
  } catch (error) {
    console.error('Error extracting author quotes:', error);
    return null;
  }
}

// Function to get the entire knowledge base content
async function getEntireKnowledgeBase() {
  try {
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    const files = await fs.readdir(kbDir);
    
    let allContent = '';
    
    for (const file of files) {
      const filePath = path.join(kbDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const content = await fs.readFile(filePath, 'utf8');
        allContent += `\n\n--- From file: ${file} ---\n\n${content}`;
      }
    }
    
    return allContent;
  } catch (error) {
    console.error('Error reading knowledge base:', error);
    return null;
  }
}

// Function to search for specific text in the knowledge base
async function searchDirectInKnowledgeBase(query: string) {
  try {
    const content = await getEntireKnowledgeBase();
    if (!content) return null;
    
    // Special handling for section-based queries
    const sectionMatch = query.match(/(?:list|show|tell me about|what are) the\s+(.+?)(?:\s+section|\s+in your knowledge base|$)/i);
    if (sectionMatch && sectionMatch[1]) {
      const sectionName = sectionMatch[1].trim();
      console.log('🔍 Looking for section:', sectionName);
      
      // Look for sections with that name
      const sectionRegex = new RegExp(`#+\\s*${sectionName.replace(/\s+/g, '\\s+')}`, 'i');
      const sections = content.split(/^#+\s+/m);
      
      for (const section of sections) {
        if (sectionRegex.test(section)) {
          console.log('📗 Found matching section header');
          return section;
        }
      }
      
      // If direct section match not found, try looser matching
      const looserRegex = new RegExp(sectionName.split(/\s+/).join('.*'), 'i');
      for (const section of sections) {
        if (looserRegex.test(section)) {
          console.log('📙 Found partial section match');
          return section;
        }
      }
    }
    
    // Process regular keyword search
    // Create search terms from the query (more permissive than before)
    const searchTerms = query
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(word => word.length > 2 && !['the', 'and', 'what', 'when', 'where', 'which', 'about', 'your', 'have', 'does', 'that', 'this', 'with', 'from', 'list'].includes(word));
    
    // Add multi-word combinations for better matching
    const multiWordTerms = [];
    for (let i = 0; i < searchTerms.length - 1; i++) {
      multiWordTerms.push(`${searchTerms[i]} ${searchTerms[i+1]}`);
    }
    
    const allTerms = [...searchTerms, ...multiWordTerms];
    console.log('🔍 Search terms extracted:', allTerms);
    
    // First, try to find exact heading matches
    const headingMatches = [];
    const headingRegex = /^#+\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const heading = match[1].toLowerCase();
      if (allTerms.some(term => heading.includes(term))) {
        // Get the content under this heading until the next heading
        const startIndex = match.index;
        const nextHeadingMatch = /^#+\s+/gm.exec(content.slice(startIndex + match[0].length));
        const endIndex = nextHeadingMatch 
          ? startIndex + match[0].length + nextHeadingMatch.index 
          : content.length;
        
        const sectionContent = content.slice(startIndex, endIndex);
        headingMatches.push(sectionContent);
      }
    }
    
    if (headingMatches.length > 0) {
      console.log('📑 Found heading matches:', headingMatches.length);
      return headingMatches.join('\n\n');
    }
    
    // If no heading matches, find paragraphs containing search terms
    // Split by both paragraphs and section markers
    const chunks = content.split(/\n\n+|(?=^#+\s+)/m);
    const relevantChunks = chunks.filter(chunk => {
      const chunkLower = chunk.toLowerCase();
      return allTerms.some(term => chunkLower.includes(term));
    });
    
    if (relevantChunks.length > 0) {
      console.log('📄 Found keyword matches:', relevantChunks.length);
      // Sort by relevance (number of matching terms)
      relevantChunks.sort((a, b) => {
        const aMatches = allTerms.filter(term => a.toLowerCase().includes(term)).length;
        const bMatches = allTerms.filter(term => b.toLowerCase().includes(term)).length;
        return bMatches - aMatches;
      });
      
      // Take up to 15 most relevant chunks
      return relevantChunks.slice(0, 15).join('\n\n');
    }
    
    // If still nothing, try even looser matching with just 2-character keywords
    const shortSearchTerms = query
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(word => word.length > 1 && !['to', 'in', 'on', 'at', 'is', 'am', 'are', 'be', 'of'].includes(word));
    
    console.log('🔍 Trying shorter search terms:', shortSearchTerms);
    
    const looseMatches = chunks.filter(chunk => {
      const chunkLower = chunk.toLowerCase();
      return shortSearchTerms.some(term => chunkLower.includes(term));
    });
    
    if (looseMatches.length > 0) {
      console.log('📃 Found loose matches:', looseMatches.length);
      return looseMatches.slice(0, 10).join('\n\n');
    }
    
    return null;
  } catch (error) {
    console.error('Error searching in knowledge base:', error);
    return null;
  }
}

// Function to check if the query is about a file and get file information
async function getFileInformation(query: string) {
  try {
    // Common patterns for asking about files
    const filePatterns = [
      /(?:was|is) (.+?) (?:uploaded|indexed|added)/i,
      /(?:what is in|about|content of) (.+?)(?:\?|$)/i,
      /(?:transcript|content) (?:of|for|in) (.+?)(?:\?|$)/i,
      /(.+?) transcript/i,
      /new file (.+?)(?: was)? uploaded/i
    ];
    
    // Try to extract a file name from the query
    let fileName = null;
    const transcriptQuery = query.match(/(?:transcript|content|diggnation|episode|e013)/i);
    const isTranscriptQuery = !!transcriptQuery;

    // First check for general transcript queries
    if (isTranscriptQuery && !fileName) {
      console.log('📝 Processing general transcript query');
      // Default to looking for transcript files if no specific file is mentioned
      fileName = 'transcript';
    }

    // Then try the specific file patterns
    for (const pattern of filePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        fileName = match[1].trim();
        if (fileName) break;
      }
    }
    
    if (!fileName) return null;
    
    console.log(`🔍 Looking for file information about: ${fileName}`);
    
    // Get a list of all files in the knowledge base
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    const files = await fs.readdir(kbDir);
    
    // Find files that match the extracted name (partial or full match)
    const matchingFiles = files.filter(file => 
      file.toLowerCase().includes(fileName!.toLowerCase())
    );
    
    if (matchingFiles.length === 0) {
      console.log(`❌ No matching files found for: ${fileName}`);
      return null;
    }
    
    console.log(`✅ Found ${matchingFiles.length} matching files: ${matchingFiles.join(', ')}`);
    
    // Get content and information about the files
    let fileInfo = '';
    for (const file of matchingFiles) {
      const filePath = path.join(kbDir, file);
      const stats = await fs.stat(filePath);
      
      // Add basic file info
      fileInfo += `File: ${file}\n`;
      fileInfo += `Size: ${(stats.size / 1024).toFixed(2)} KB\n`;
      fileInfo += `Last Modified: ${stats.mtime.toLocaleString()}\n\n`;
      
      // Add content preview for text files
      try {
        if (file.match(/\.(txt|md|csv|json|xml|html|htm)$/i)) {
          const content = await fs.readFile(filePath, 'utf8');
          const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
          fileInfo += `Content Preview:\n${preview}\n\n`;
          
          // Count occurrences of "digg" if the query asks about it
          if (/how many times.*digg/i.test(query)) {
            const diggMatches = content.match(/digg/gi);
            const count = diggMatches ? diggMatches.length : 0;
            fileInfo += `The word "digg" appears ${count} times in this file.\n\n`;
          }
          
          // Extract quotes with "digg" if the query asks about it
          if (/quote.*digg|digg.*quote/i.test(query)) {
            const lines = content.split(/\n/);
            const diggLines = lines.filter(line => line.toLowerCase().includes('digg'));
            fileInfo += `Quotes containing "digg":\n${diggLines.join('\n')}\n\n`;
          }
        } else {
          fileInfo += `Non-text file. Unable to show content preview.\n\n`;
        }
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
        fileInfo += `Error reading file content.\n\n`;
      }

      // Special handling for transcript files
      if (file.toLowerCase().includes('transcript')) {
        console.log('📑 Processing transcript file content');
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          // Count mentions of specific terms
          const countTerms = ['digg', 'diggnation', 'kevin', 'alex'];
          const counts: Record<string, number> = {};
          
          for (const term of countTerms) {
            const regex = new RegExp(term, 'gi');
            const matches = content.match(regex);
            counts[term] = matches ? matches.length : 0;
          }
          
          fileInfo += `Word counts in transcript:\n`;
          for (const [term, count] of Object.entries(counts)) {
            fileInfo += `- "${term}": ${count} occurrences\n`;
          }
          fileInfo += '\n';
          
          // Extract some sample quotes with digg mentions
          const diggLines = content.split(/\n/)
            .filter((line: string) => line.toLowerCase().includes('digg'))
            .slice(0, 5); // Limit to first 5 mentions
          
          if (diggLines.length > 0) {
            fileInfo += `Sample quotes containing "digg":\n`;
            fileInfo += diggLines.join('\n') + '\n\n';
          }
        } catch (error) {
          console.error(`Error analyzing transcript file ${file}:`, error);
          fileInfo += `Error analyzing transcript content.\n\n`;
        }
      }
    }
    
    return fileInfo;
  } catch (error) {
    console.error('Error getting file information:', error);
    return null;
  }
}

// Function to count occurrences in a direct, reliable way
async function directWordCount(term: string, specificFile?: string) {
  try {
    console.log(`🧮 Starting direct word count for "${term}" ${specificFile ? `in file ${specificFile}` : 'across all files'}`);
    
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    const files = await fs.readdir(kbDir);
    console.log(`📚 Found ${files.length} files in knowledge base directory`);
    
    let totalCount = 0;
    const fileDetails: {fileName: string, count: number, examples: string[]}[] = [];
    
    // If we're looking for a specific file by pattern, log all files to help with debugging
    if (specificFile) {
      console.log(`📋 Available files in knowledge base: ${files.join(', ')}`);
      console.log(`🔍 Looking for file matching: ${specificFile}`);
    }
    
    for (const file of files) {
      // If a specific file is requested and this doesn't match, skip it
      if (specificFile && !file.toLowerCase().includes(specificFile.toLowerCase())) {
        continue;
      }
      
      console.log(`📄 Processing file: ${file}`);
      const filePath = path.join(kbDir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile()) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          // Count raw occurrences with simple string matching
          let count = 0;
          let lowerContent = content.toLowerCase();
          let lowerTerm = term.toLowerCase();
          
          // Arrays to store examples and positions
          const examples: string[] = [];
          const positions: number[] = [];
          
          // Log the file size to help with debugging
          console.log(`📄 File size: ${content.length} characters`);
          
          // Special handling for the term "cocktail" since it's causing issues
          if (lowerTerm === "cocktail") {
            console.log(`🍸 Special handling for "cocktail" term detected`);
            // This is a direct check for all instances of "cocktail" 
            const cocktailMatches = lowerContent.match(/cocktail/g);
            if (cocktailMatches) {
              count = cocktailMatches.length;
              console.log(`🍸 Found ${count} occurrences of "cocktail" using regex pattern`);
              
              // Find examples of cocktail mentions
              const lines = content.split('\n');
              for (const line of lines) {
                if (line.toLowerCase().includes('cocktail') && examples.length < 5) {
                  examples.push(line.trim());
                }
              }
              
              // Instead of entering the regular counting loop, we'll skip to the end
              totalCount += count;
              fileDetails.push({fileName: file, count, examples});
              console.log(`📊 Added ${count} cocktail occurrences from ${file} to total count`);
              continue; // Skip the regular counting process
            }
          }
          
          // Test for presence of the term
          if (lowerContent.includes(lowerTerm)) {
            console.log(`✅ Term "${term}" found in file ${file}`);
          } else {
            console.log(`❌ Term "${term}" NOT found in file ${file}`);
            // Debug: look for similar terms
            const similarTerms = ['cocktails', 'cocktail.', 'cocktail,', 'cockt'];
            for (const similar of similarTerms) {
              if (lowerContent.includes(similar.toLowerCase())) {
                console.log(`🤔 However, found similar term "${similar}" in file`);
              }
            }
          }
          
          // Manual counting loop that counts each occurrence
          let position = 0;
          
          while ((position = lowerContent.indexOf(lowerTerm, position)) !== -1) {
            count++;
            positions.push(position);
            position += lowerTerm.length;
            
            // Log each occurrence position for debugging
            if (count <= 10) {
              const contextStart = Math.max(0, position - 20);
              const contextEnd = Math.min(lowerContent.length, position + 20);
              const context = content.substring(contextStart, contextEnd);
              console.log(`🔍 Occurrence ${count}: at position ${position}, context: "${context}"`);
            }
            
            // Find the line containing this occurrence for examples
            if (examples.length < 5) {
              // Get the line containing this match
              const lineStart = lowerContent.lastIndexOf('\n', position);
              const lineEnd = lowerContent.indexOf('\n', position);
              const line = content.substring(
                lineStart > 0 ? lineStart + 1 : 0,
                lineEnd > 0 ? lineEnd : content.length
              );
              
              if (line.trim() && !examples.includes(line.trim())) {
                examples.push(line.trim());
              }
            }
          }
          
          // Log detailed results
          console.log(`📊 Found ${count} occurrences of "${term}" in ${file}`);
          if (count > 0) {
            console.log(`📍 Term positions: ${positions.join(', ')}`);
          }
          
          totalCount += count;
          fileDetails.push({fileName: file, count, examples});
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }
    
    // Sort results by count (highest first)
    fileDetails.sort((a, b) => b.count - a.count);
    
    console.log(`📈 Total count across all files: ${totalCount}`);
    console.log(`📊 File breakdown: ${fileDetails.map(f => `${f.fileName}: ${f.count}`).join(', ')}`);
    
    return {
      totalCount,
      fileDetails,
      term
    };
  } catch (error) {
    console.error(`Error counting occurrences of "${term}":`, error);
    return {
      totalCount: 0,
      fileDetails: [],
      term
    };
  }
}

// Function to get all available knowledge base files
async function getKnowledgeBaseFiles() {
  try {
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    const files = await fs.readdir(kbDir);
    return files;
  } catch (error) {
    console.error('Error reading knowledge base directory:', error);
    return [];
  }
}

// Enhanced function to find the most relevant document based on query
async function findRelevantDocument(query: string) {
  try {
    // Get all files from knowledge base
    const allFiles = await getKnowledgeBaseFiles();
    console.log(`📚 Knowledge base contains ${allFiles.length} files: ${allFiles.join(', ')}`);
    
    // Explicitly look for episode number references first - high precision match
    const episodeMatch = query.match(/episode\s*(\d+)|e(\d+)/i);
    if (episodeMatch) {
      const episodeNum = episodeMatch[1] || episodeMatch[2];
      const paddedEpisode = episodeNum.padStart(3, '0');
      const pattern = `E${paddedEpisode}`;
      
      // Look for exact episode match first
      const exactMatches = allFiles.filter(f => f.includes(pattern));
      if (exactMatches.length > 0) {
        console.log(`📺 Found exact episode ${episodeNum} match: ${exactMatches[0]}`);
        return exactMatches[0];
      }
    }
    
    // Check for explicit GTM/markdown references
    if (query.match(/\b(?:gtm|go.?to.?market|author|quotes?)\b/i)) {
      const mdFiles = allFiles.filter(f => f.toLowerCase().endsWith('.md'));
      if (mdFiles.length > 0) {
        console.log(`📋 Found markdown file for GTM/author query: ${mdFiles[0]}`);
        return mdFiles[0];
      }
    }
    
    // Check for various file type references
    const fileTypeMap: Record<string, string[]> = {
      transcript: allFiles.filter(f => 
        f.toLowerCase().includes('transcript') || 
        f.match(/e\d+/i) ||
        f.includes('diggnation')
      ),
      markdown: allFiles.filter(f => 
        f.toLowerCase().endsWith('.md') || 
        f.toLowerCase().includes('gtm') ||
        f.toLowerCase().includes('digg')
      ),
      authors: allFiles.filter(f => 
        f.toLowerCase().includes('gtm') || 
        f.toLowerCase().includes('author') ||
        f.toLowerCase().includes('quote')
      ),
    };
    
    // Look for specific file type references in the query
    let relevantFiles: string[] = [];
    
    if (query.match(/\b(?:transcript|episode|diggnation|e\d+)\b/i)) {
      console.log('📝 Query references transcripts or episodes');
      relevantFiles = fileTypeMap.transcript;
    } 
    else if (query.match(/\b(?:gtm|go.?to.?market|markdown|author|quote)\b/i)) {
      console.log('📋 Query references GTM, markdown, or authors');
      relevantFiles = fileTypeMap.markdown;
    }
    else if (query.match(/\b(?:digg|market)\b/i)) {
      console.log('🔍 Query mentions Digg or marketing');
      relevantFiles = [...fileTypeMap.markdown, ...fileTypeMap.transcript];
    }
    
    if (relevantFiles.length > 0) {
      console.log(`📄 Found ${relevantFiles.length} relevant files: ${relevantFiles.join(', ')}`);
      return relevantFiles[0]; // Return the most relevant file
    }
    
    // If query mentions "that document" or similar, check conversation history context
    // This helps with follow-up questions about the same document
    if (query.match(/(?:that|this|the)\s+(?:document|file|transcript|episode)/i)) {
      // Default to transcript for "that episode" and md file for other references
      if (query.match(/(?:that|this|the)\s+episode/i) && fileTypeMap.transcript.length > 0) {
        console.log(`📺 Query references "that episode" - defaulting to transcript: ${fileTypeMap.transcript[0]}`);
        return fileTypeMap.transcript[0];
      } else if (fileTypeMap.markdown.length > 0) {
        console.log(`📋 Query references "that document" - defaulting to markdown: ${fileTypeMap.markdown[0]}`);
        return fileTypeMap.markdown[0];
      }
    }
    
    // Default to the first file if we can't determine relevance
    if (allFiles.length > 0) {
      console.log(`⚠️ No specific file reference found, defaulting to first file: ${allFiles[0]}`);
      return allFiles[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding relevant document:', error);
    return null;
  }
}

// For topic analysis queries, use the document API
async function getDocumentAnalysis(query: string) {
  try {
    // More inclusive topic/content analysis patterns
    const isTopicQuery = /(?:topic|store|discuss|talk|content|point|subject|mention|primary|key|theme|about|what|summary|cover|happen|event|issue|detail|describe)/i.test(query);
    
    // Also consider any query that directly references documents/episodes
    const isDocumentQuery = /(?:episode|transcript|file|document|markdown|gtm|dignation|e\d+|that\s+episode)/i.test(query);
    
    // Proceed if either condition is met
    if (!(isTopicQuery || isDocumentQuery)) return null;
    
    console.log('📊 Processing document analysis for query about content or specific document');
    
    // Improve document reference detection
    let documentName = '';
    let episodeNumber = '';

    // Extract episode number if present - handle both direct and reference cases
    const episodeMatch = query.match(/episode (\d+)|e(\d+)/i);
    if (episodeMatch) {
      episodeNumber = episodeMatch[1] || episodeMatch[2];
      console.log(`📺 Detected explicit episode reference: Episode ${episodeNumber}`);
    } 

    // First check if there's a direct document reference
    // Use a more specific pattern to avoid extracting too much text as a document name
    const directDocMatch = query.match(/in (?:the )?(?:file |transcript |document |)"([^"]{1,50})"|in (?:the )?(?:file |transcript |document )([^.,?!]{1,50})/i);
    if (directDocMatch && (directDocMatch[1] || directDocMatch[2])) {
      documentName = (directDocMatch[1] || directDocMatch[2]).trim();
      console.log(`📄 Detected direct document reference: "${documentName}"`);
    }
    // Check for references to specific file types without extracting the entire query
    else if (query.match(/(?:that|the|this)\s+(?:episode|transcript|file|document|markdown|gtm|go.?to.?market)/i)) {
      console.log(`🔎 Detected reference to a document without specific name - finding most relevant file`);
      
      // Find the most relevant document based on query content
      const relevantDoc = await findRelevantDocument(query);
      if (relevantDoc) {
        documentName = relevantDoc;
        console.log(`📄 Selected relevant document: ${documentName}`);
        
        // Try to extract episode number from the filename if it's a transcript
        if (documentName.match(/transcript|e\d+/i)) {
          const fileEpisodeMatch = documentName.match(/e(\d+)/i);
          if (fileEpisodeMatch && fileEpisodeMatch[1]) {
            episodeNumber = fileEpisodeMatch[1];
            console.log(`📺 Extracted episode number ${episodeNumber} from file ${documentName}`);
          }
        }
      }
    }

    // Build the API URL - prioritize document name over episode number
    const apiUrl = new URL('http://localhost:3000/api/documents');
    if (documentName) {
      apiUrl.searchParams.append('document', documentName);
    } else if (episodeNumber) {
      apiUrl.searchParams.append('episodeNumber', episodeNumber);
    } else {
      // Without specific document/episode, we can't proceed
      return null;
    }
    
    // Always request analysis
    apiUrl.searchParams.append('analyze', 'true');
    
    console.log(`🔍 Calling document analysis API: ${apiUrl.toString()}`);
    
    // Fetch document with analysis
    const response = await fetch(apiUrl.toString());
    if (!response.ok) {
      console.error(`❌ Error from document API: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`📋 Retrieved document: ${data.file} with ${data.analysis?.timeBlocks || 0} blocks`);
    
    // Format structured analysis as context
    let analysisContext = `Document Analysis: ${data.file}\n\n`;
    
    if (data.analysis) {
      // Handle different document types
      if (data.analysis.type === 'markdown') {
        // For markdown files, prioritize authors, quotes, and key points
        
        // Add authors if available
        if (data.analysis.authors && data.analysis.authors.length > 0) {
          analysisContext += `Authors & References:\n`;
          data.analysis.authors.forEach((author: string) => {
            analysisContext += `- ${author}\n`;
          });
          analysisContext += `\n`;
        }
        
        // Add quotes if available
        if (data.analysis.quotes && data.analysis.quotes.length > 0) {
          analysisContext += `Key Quotes:\n`;
          data.analysis.quotes.forEach((quote: string) => {
            analysisContext += `"${quote}"\n\n`;
          });
        }
        
        // Add key points if available
        if (data.analysis.keyPoints && data.analysis.keyPoints.length > 0) {
          analysisContext += `Key Points:\n`;
          data.analysis.keyPoints.forEach((point: any) => {
            analysisContext += `[${point.title}] ${point.content}\n\n`;
          });
        }
        
        // Add document outline
        if (data.analysis.sections && data.analysis.sections.length > 0) {
          analysisContext += `Document Structure:\n`;
          data.analysis.sections.forEach((section: any) => {
            const indent = '  '.repeat(section.level - 1);
            analysisContext += `${indent}${section.title}\n`;
          });
          analysisContext += `\n`;
        }
        
        // Add full section content for important sections
        if (data.analysis.fullSections && data.analysis.fullSections.length > 0) {
          const importantSections = data.analysis.fullSections.filter((section: any) => 
            /strategic|plan|phase|goal|action|author|quote|relevant/i.test(section.title)
          );
          
          if (importantSections.length > 0) {
            analysisContext += `Important Section Content:\n\n`;
            importantSections.slice(0, 3).forEach((section: any) => {
              analysisContext += `### ${section.title} ###\n`;
              analysisContext += section.content.join('\n').slice(0, 500);
              if (section.content.join('\n').length > 500) analysisContext += '...';
              analysisContext += `\n\n`;
            });
          }
        }
      }
      else if (data.analysis.type === 'transcript') {
        // Add main topics if available - this is the most useful part for answering topic questions
        if (data.analysis.mainTopics && data.analysis.mainTopics.length > 0) {
          analysisContext += `Main Topics Discussed:\n`;
          data.analysis.mainTopics.forEach((topic: any, index: number) => {
            analysisContext += `${index + 1}. [${topic.timestamp}] ${topic.title}\n`;
            analysisContext += `   ${topic.summary}\n\n`;
          });
          analysisContext += `\n`;
        }
      }
    
      // Basic stats for all document types
      analysisContext += `Document Statistics:\n`;
      analysisContext += `- Type: ${data.file.split('.').pop()}\n`;
      analysisContext += `- Size: ${Math.round(data.size / 1024)} KB\n`;
      if (data.analysis.lineCount) analysisContext += `- Lines: ${data.analysis.lineCount}\n`;
      if (data.analysis.wordCount) analysisContext += `- Words: ${data.analysis.wordCount}\n`;
      if (data.analysis.timeBlocks) analysisContext += `- Time blocks: ${data.analysis.timeBlocks}\n`;
      analysisContext += `\n`;
      
      // Top terms for all document types
      if (data.analysis.topTerms && data.analysis.topTerms.length > 0) {
        analysisContext += `Top Terms (most frequent words):\n`;
        const termsToShow = data.analysis.topTerms.slice(0, 15);
        analysisContext += termsToShow.map((term: any) => 
          `- "${term.term}": ${term.count} occurrences`
        ).join('\n');
        analysisContext += '\n\n';
      }
      
      // Content sample only for documents without specialized analysis
      if ((!data.analysis.mainTopics || data.analysis.mainTopics.length === 0) && 
          (!data.analysis.keyPoints || data.analysis.keyPoints.length === 0)) {
        // Content summary from blocks or content
        if (data.analysis.blocks && data.analysis.blocks.length > 0) {
          analysisContext += `Content Sample (by timestamp):\n\n`;
          
          // Take a representative sample of blocks (beginning, middle, end)
          const blocks = data.analysis.blocks;
          const totalBlocks = blocks.length;
          const samplesToTake = Math.min(10, totalBlocks);
          const step = totalBlocks / samplesToTake;
          
          const sampledBlocks = [];
          for (let i = 0; i < totalBlocks; i += step) {
            const blockIndex = Math.floor(i);
            if (blockIndex < totalBlocks) {
              sampledBlocks.push(blocks[blockIndex]);
            }
          }
          
          // Add the sampled blocks to context
          for (const block of sampledBlocks) {
            analysisContext += `[${block.timestamp}] ${block.text.join(' ').slice(0, 200)}${block.text.join(' ').length > 200 ? '...' : ''}\n\n`;
          }
        }
      }
    } else {
      // For documents without analysis, include a content excerpt
      analysisContext += `Content excerpt (first 1000 characters):\n`;
      analysisContext += data.content.slice(0, 1000) + '...\n\n';
    }
    
    return analysisContext;
  } catch (error) {
    console.error('Error processing document analysis:', error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { messages, instructions } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get the latest instructions from file storage
    const savedInstructions = await getLatestInstructions();
    const finalInstructions = instructions || savedInstructions;

    // Get relevant context from vector store or direct extraction
    let context = '';
    try {
      const lastMessage = messages[messages.length - 1];
      console.log('🔍 Searching for:', lastMessage.content);
      
      // Check for word count queries
      const wordCountMatch = lastMessage.content.match(/how many times (?:is|does|was|were) (?:the )?(?:word |term |phrase |string )?"?([\w\s]+)"? (?:mentioned|appear|used|occur|found|show up|included|in|throughout|across|present)/i) || 
        lastMessage.content.match(/(?:count|tally|number of) (?:occurrences of |mentions of |times |instances of |)(?:the )?(?:word |term |phrase |)"?([\w\s]+)"?/i);
      
      if (wordCountMatch && wordCountMatch[1]) {
        let searchTerm = wordCountMatch[1].toLowerCase().trim();
        console.log(`📊 Processing word count query for: "${searchTerm}"`);
        
        try {
          // Check for episode mentions to build the correct query
          let apiUrl = new URL('/api/count', 'http://localhost:3000');
          apiUrl.searchParams.append('term', searchTerm);
          
          // Check for episode mentions
          const episodeMatch = lastMessage.content.match(/episode (\d+)|e(\d+)/i);
          if (episodeMatch) {
            const episodeNumber = episodeMatch[1] || episodeMatch[2];
            console.log(`📺 Detected episode reference: Episode ${episodeNumber}`);
            apiUrl.searchParams.append('episodeNumber', episodeNumber);
          } 
          // Check for document mentions
          else {
            const documentMatch = lastMessage.content.match(/in (?:the )?(?:file |transcript |document |)"?([^"?]+)"?/i) ||
              lastMessage.content.match(/(?:file|transcript|document) (?:named|called|titled) "?([^"?]+)"?/i);
            
            if (documentMatch && documentMatch[1]) {
              const documentName = documentMatch[1].trim();
              console.log(`📄 Detected document reference: "${documentName}"`);
              apiUrl.searchParams.append('document', documentName);
            }
          }
          
          console.log(`🔍 Calling count API: ${apiUrl.toString()}`);
          
          // Call our general-purpose counting API
          const response = await fetch(apiUrl.toString());
          if (response.ok) {
            const data = await response.json();
            console.log(`📊 Count API found ${data.totalCount} occurrences of "${searchTerm}"`);
            
            // Format the results into context
            let countContext = `Word Count Analysis for "${searchTerm}":\n\n`;
            countContext += `Total occurrences: ${data.totalCount}\n\n`;
            
            if (data.results && data.results.length > 0) {
              countContext += `Breakdown by file:\n`;
              for (const result of data.results) {
                countContext += `- ${result.file}: ${result.count} occurrences\n`;
              }
              
              countContext += `\nExample mentions:\n`;
              
              // Get examples from the file with the most occurrences
              const topResult = data.results[0];
              if (topResult && topResult.examples && topResult.examples.length > 0) {
                for (const example of topResult.examples) {
                  countContext += `"${example}"\n`;
                }
              }
            }
            
            context = countContext;
            console.log('📊 Generated word count context');
          } else {
            console.error(`❌ Error from count API: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`❌ Error in word count processing:`, error);
        }
      }

      // If it's not a word count query, check for topic/content analysis query
      if (!context) {
        console.log('🔎 Checking for document/topic analysis query');
        const topicAnalysis = await getDocumentAnalysis(lastMessage.content);
        if (topicAnalysis) {
          context = topicAnalysis;
          console.log('📊 Generated document analysis context');
        }
      }

      // If no context yet, try to find any document reference that might be relevant
      if (!context && lastMessage.content.match(/(?:transcript|episode|file|document|gtm|markdown|dignation|e\d+)/i)) {
        console.log('📄 Query appears to reference a document - trying document finder');
        const relevantDoc = await findRelevantDocument(lastMessage.content);
        
        if (relevantDoc) {
          console.log(`📑 Found relevant document: ${relevantDoc}`);
          // Call the document API directly
          const apiUrl = new URL('http://localhost:3000/api/documents');
          apiUrl.searchParams.append('document', relevantDoc);
          apiUrl.searchParams.append('analyze', 'true');
          
          try {
            const response = await fetch(apiUrl.toString());
            if (response.ok) {
              const data = await response.json();
              
              // Create a structured context from document analysis
              const docType = data.file.toLowerCase().endsWith('.md') ? 'markdown' : 'transcript';
              const isTranscript = docType === 'transcript';
              
              // Basic document info
              let docContext = `Document Source: ${data.file}\n`;
              docContext += `Type: ${docType}\n`;
              docContext += `Size: ${Math.round(data.size / 1024)} KB\n\n`;
              
              if (isTranscript && data.analysis) {
                // Add structured content for transcripts
                if (data.analysis.mainTopics && data.analysis.mainTopics.length > 0) {
                  docContext += "Main discussion topics:\n";
                  data.analysis.mainTopics.forEach((topic: any, i: number) => {
                    docContext += `${i+1}. [${topic.timestamp}] ${topic.title}: ${topic.summary}\n`;
                  });
                  docContext += "\n";
                }
                
                // Add representative timestamp samples
                docContext += "Selected transcript excerpts (with timestamps):\n";
                
                // If we have blocks, select representative samples
                if (data.analysis.blocks && data.analysis.blocks.length > 0) {
                  const blocks = data.analysis.blocks;
                  const totalBlocks = blocks.length;
                  
                  // Choose blocks from beginning, middle and end
                  const samplingPositions = [
                    0, 
                    Math.floor(totalBlocks * 0.25), 
                    Math.floor(totalBlocks * 0.5),
                    Math.floor(totalBlocks * 0.75),
                    totalBlocks - 1
                  ];
                  
                  // Also add some random samples
                  for (let i = 0; i < 10; i++) {
                    const randPos = Math.floor(Math.random() * totalBlocks);
                    if (!samplingPositions.includes(randPos)) {
                      samplingPositions.push(randPos);
                    }
                  }
                  
                  // Sort to maintain chronological order
                  samplingPositions.sort((a, b) => a - b);
                  
                  // Add each sampled block to context
                  samplingPositions.slice(0, 15).forEach(pos => {
                    const block = blocks[pos];
                    if (block && block.timestamp && block.text) {
                      docContext += `[${block.timestamp}] ${block.text.join(' ').slice(0, 200)}${block.text.join(' ').length > 200 ? '...' : ''}\n\n`;
                    }
                  });
                }
              } else if (docType === 'markdown' && data.analysis) {
                // Add structured content for markdown
                if (data.analysis.sections && data.analysis.sections.length > 0) {
                  docContext += "Document sections:\n";
                  data.analysis.sections.forEach((section: any) => {
                    const indent = '  '.repeat(section.level - 1);
                    docContext += `${indent}${section.title}\n`;
                  });
                  docContext += "\n";
                }
                
                if (data.analysis.keyPoints && data.analysis.keyPoints.length > 0) {
                  docContext += "Key points from the document:\n";
                  data.analysis.keyPoints.slice(0, 10).forEach((point: any, i: number) => {
                    docContext += `${i+1}. [${point.title}] ${point.content}\n\n`;
                  });
                }
                
                if (data.analysis.authors && data.analysis.authors.length > 0) {
                  docContext += "Authors mentioned:\n";
                  data.analysis.authors.forEach((author: string) => {
                    docContext += `- ${author}\n`;
                  });
                  docContext += "\n";
                }
              } else {
                // Fallback to content excerpt
                docContext += "Document content excerpt:\n";
                docContext += data.content.slice(0, 2000) + "...\n";
              }
              
              // Add content excerpt if query is asking for specific details
              if (lastMessage.content.match(/what exactly|details|specific|verbatim|exact|transcript|content|full text/i)) {
                docContext += "\nAdditional content excerpt:\n";
                docContext += data.content.slice(0, 3000) + "...\n";
              }
              
              context = docContext;
              console.log(`📄 Added structured document context (${docContext.length} characters)`);
            }
          } catch (error) {
            console.error('Error fetching document content:', error);
          }
        }
      }

      // If it's not a word count query or topic analysis, continue with existing logic
      if (!context) {
        console.log('⚠️ No specialized context found, falling back to standard search');
        // Check if the query is about a file or transcript
        const isFileQuery = /file|upload|transcript|index/i.test(lastMessage.content);
        if (isFileQuery) {
          console.log('📁 Processing as file query');
          const fileInfo = await getFileInformation(lastMessage.content);
          if (fileInfo) {
            context = fileInfo;
            console.log('💾 Found file information');
          }
        }
        
        // If this isn't a file query or no file info was found
        if (!context) {
          // Check if this is an author/quote related query
          const isAuthorQuery = /author|quote|who wrote|list.*books|writer|wrote/i.test(lastMessage.content);
          
          if (isAuthorQuery) {
            console.log('📚 Directly extracting author quotes section');
            const authorQuotes = await extractAuthorQuotes();
            if (authorQuotes) {
              context = authorQuotes;
              console.log('📑 Found author quotes section:', authorQuotes.substring(0, 100) + '...');
            }
          } 
          
          // If no author context or not an author query, try direct keyword search
          if (!context) {
            console.log('🔎 Trying direct keyword search in knowledge base');
            const directResults = await searchDirectInKnowledgeBase(lastMessage.content);
            if (directResults) {
              context = directResults;
              console.log('📄 Found direct matches in knowledge base:', directResults.substring(0, 100) + '...');
            }
          }
          
          // If still no context, load the entire knowledge base as a last resort
          if (!context) {
            console.log('📚 Using entire knowledge base as context');
            const entireKB = await getEntireKnowledgeBase();
            if (entireKB) {
              context = entireKB;
              console.log('📚 Using full knowledge base (length):', entireKB.length);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error retrieving context:', error);
      // Continue without context if there's an error
    }

    // Construct system message with context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant with access to a knowledge base. 
      
When answering questions, follow these guidelines:

1. KNOWLEDGE BASE QUERIES: For questions about specific information in the knowledge base (authors, quotes, files, etc.), use ONLY the content provided in the "Relevant Context" section. Be accurate and cite the knowledge base.

2. AVOID HALLUCINATIONS: Never make up information that isn't present in the knowledge base. If asked to summarize or extract information from documents, reference ONLY what's explicitly provided in the context. If asked to create show notes, chapter markers or summaries, use ONLY timestamps and content from the provided transcript excerpts.

3. TRANSCRIPT HANDLING: When working with transcripts, use the exact timestamps provided in the context (e.g. [0:05:23]) rather than rounding to minutes. Don't invent timestamps or content that isn't in the provided excerpts.

4. GENERAL KNOWLEDGE: For general questions or when the knowledge base doesn't contain the specific information requested:
   - First acknowledge that the specific information isn't in your knowledge base
   - Then provide a helpful response based on your general knowledge
   - Clearly indicate when you're using general knowledge versus knowledge base information

5. UNCERTAINTY: If uncertain about specific details, acknowledge the uncertainty rather than making up information from the knowledge base.${
        finalInstructions ? `\n\nCustom Instructions:\n${finalInstructions}` : ""
      }${
        context
          ? `\n\nRelevant Context:\n${context}`
          : "\n\nNote: No relevant information was found in the knowledge base for this query."
      }`,
    };

    console.log('🧠 Context length provided to LLM:', context.length);
    console.log('📝 System prompt first 200 chars:', systemMessage.content.substring(0, 200) + '...');

    // Get completion from OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [systemMessage, ...messages],
      temperature: 0.3, // Lowered temperature for more factual responses
      max_tokens: 1000,
    });

    const responseMessage = completion.choices[0].message;
    console.log('🤖 Response first 100 chars:', responseMessage.content?.substring(0, 100) + '...');

    return NextResponse.json({
      message: {
        role: 'assistant',
        content: responseMessage.content || ''
      },
      hasContext: context.length > 0,
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 