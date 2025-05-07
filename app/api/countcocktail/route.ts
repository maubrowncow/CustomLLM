import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const term = url.searchParams.get('term') || 'cocktail';
    const documentName = url.searchParams.get('document') || '';
    
    console.log(`API: Counting occurrences of "${term}" in files`);
    
    const kbDir = path.join(process.cwd(), 'data', 'knowledge_base');
    
    // If no specific document is provided, we'll check all documents
    let filesToCheck: string[] = [];
    
    if (documentName) {
      // Get files matching the document name
      const allFiles = await fs.readdir(kbDir);
      filesToCheck = allFiles.filter(file => 
        file.toLowerCase().includes(documentName.toLowerCase())
      );
      
      if (filesToCheck.length === 0) {
        return NextResponse.json(
          { error: `No files found matching "${documentName}"` },
          { status: 404 }
        );
      }
      
      console.log(`Found ${filesToCheck.length} files matching "${documentName}": ${filesToCheck.join(', ')}`);
    } else {
      // No document specified, check all files
      filesToCheck = await fs.readdir(kbDir);
      console.log(`No specific document requested, checking all ${filesToCheck.length} files`);
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
          
          // Use a regex to find all occurrences
          const regex = new RegExp(term, 'gi'); // Case insensitive
          const matches = content.match(regex);
          const count = matches ? matches.length : 0;
          
          if (count > 0) {
            console.log(`Found ${count} occurrences of "${term}" in ${file}`);
            totalCount += count;
            
            // Find all lines containing the term
            const examples = [];
            const lines = content.split('\n');
            
            for (const line of lines) {
              if (line.toLowerCase().includes(term.toLowerCase()) && examples.length < 5) {
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
    
    return NextResponse.json({
      term,
      totalCount,
      results
    });
  } catch (error) {
    console.error('Error in count term route:', error);
    return NextResponse.json(
      { error: 'Failed to count term occurrences' },
      { status: 500 }
    );
  }
} 