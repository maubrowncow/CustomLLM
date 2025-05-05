import { NextResponse } from 'next/server';
import { addDocuments } from '@/app/lib/vector-store';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: text is required' },
        { status: 400 }
      );
    }

    await addDocuments(text);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in ingest route:', error);
    return NextResponse.json(
      { error: 'Failed to ingest document' },
      { status: 500 }
    );
  }
} 