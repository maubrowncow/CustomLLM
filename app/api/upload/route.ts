import { NextResponse } from 'next/server';
import { ensureKnowledgeBaseExists, saveFile } from '@/app/lib/knowledge-base';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure knowledge base directory exists
    await ensureKnowledgeBaseExists();

    // Save the file
    await saveFile(file.name, buffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 