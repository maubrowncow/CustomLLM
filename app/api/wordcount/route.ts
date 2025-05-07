import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { term, specificFile } = await req.json();
    
    if (!term) {
      return NextResponse.json(
        { error: 'Term is required' },
        { status: 400 }
      );
    }

    console.log(`API: Counting occurrences of "${term}" ${specificFile ? `in file ${specificFile}` : 'across all files'}`);
    
    const result = await countWordOccurrences(term, specificFile);
    
    return NextResponse.json({
      term: term,
      total: result.totalCount,
      files: result.fileDetails,
    });
  } catch (error) {
    console.error('Error in wordcount route:', error);
    return NextResponse.json(
      { error: 'Failed to count word occurrences' },
      { status: 500 }
    );
  }
}

async function countWordOccurrences(term: string, specificFile?: string) {
  try {
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    const files = await fs.readdir(kbDir);
    
    let totalCount = 0;
    const fileDetails: {fileName: string, count: number, examples: string[]}[] = [];
    
    for (const file of files) {
      // If a specific file is requested and this doesn't match, skip it
      if (specificFile && !file.toLowerCase().includes(specificFile.toLowerCase())) {
        continue;
      }
      
      const filePath = path.join(kbDir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile()) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          // Count raw occurrences with simple string matching
          let count = 0;
          let lowerContent = content.toLowerCase();
          let lowerTerm = term.toLowerCase();
          let position = 0;
          
          // Examples array will store up to 5 lines containing the term
          const examples: string[] = [];
          
          // Manual counting loop
          while ((position = lowerContent.indexOf(lowerTerm, position)) !== -1) {
            count++;
            position += lowerTerm.length;
            
            // Find the line containing this occurrence
            if (examples.length < 5) {
              // Get the surrounding context for this occurrence
              const contextStart = Math.max(0, position - 100);
              const contextEnd = Math.min(lowerContent.length, position + 100);
              const context = content.substring(contextStart, contextEnd);
              
              // Find the line containing the term
              const lines = context.split('\n');
              for (const line of lines) {
                if (line.toLowerCase().includes(lowerTerm) && !examples.includes(line)) {
                  examples.push(line);
                  break;
                }
              }
            }
          }
          
          totalCount += count;
          fileDetails.push({fileName: file, count, examples});
          
          console.log(`Found ${count} occurrences of "${term}" in ${file}`);
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }
    
    // Sort results by count (highest first)
    fileDetails.sort((a, b) => b.count - a.count);
    
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