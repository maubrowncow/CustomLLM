import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generic word/term counting API endpoint
 * 
 * Query parameters:
 * - term: the word or phrase to count (required)
 * - document: optional filter to specific document(s)
 * - episodeNumber: optional episode number for transcripts
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const term = url.searchParams.get('term');
    const document = url.searchParams.get('document') || '';
    const episodeNumber = url.searchParams.get('episodeNumber');
    
    if (!term) {
      return NextResponse.json(
        { error: 'Term parameter is required' },
        { status: 400 }
      );
    }
    
    console.log(`API: Counting occurrences of "${term}"`);
    
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
    // Otherwise use all files
    else {
      filesToCheck = allFiles;
      console.log(`Checking all ${filesToCheck.length} files`);
    }
    
    if (filesToCheck.length === 0) {
      return NextResponse.json(
        { error: 'No matching files found' },
        { status: 404 }
      );
    }
    
    // Process all matching files
    const results = [];
    let totalCount = 0;
    
    for (const file of filesToCheck) {
      const filePath = path.join(kbDir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile()) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          // Count occurrences with a simple, reliable string matching approach
          const lowerContent = content.toLowerCase();
          const lowerTerm = term.toLowerCase();
          
          // Get count using regex
          const regex = new RegExp(lowerTerm, 'gi');
          const matches = content.match(regex);
          const count = matches ? matches.length : 0;
          
          if (count > 0) {
            console.log(`Found ${count} occurrences of "${term}" in ${file}`);
            totalCount += count;
            
            // Find example lines containing the term
            const examples = [];
            const lines = content.split('\n');
            
            for (const line of lines) {
              if (line.toLowerCase().includes(lowerTerm) && examples.length < 5) {
                examples.push(line.trim());
              }
            }
            
            results.push({
              file,
              count,
              examples
            });
          }
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }
    
    // Sort results by count (highest first)
    results.sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      term,
      totalCount,
      results
    });
  } catch (error) {
    console.error('Error processing count request:', error);
    return NextResponse.json(
      { error: 'Failed to count term occurrences' },
      { status: 500 }
    );
  }
} 