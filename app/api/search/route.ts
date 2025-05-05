import { NextResponse } from 'next/server';
import { similaritySearch } from '@/app/lib/vector-store';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: query is required' },
        { status: 400 }
      );
    }

    const results = await similaritySearch(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search route:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
} 