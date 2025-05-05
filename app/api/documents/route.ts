import { NextResponse } from 'next/server';
import { 
  saveKnowledgeBaseDocument, 
  getKnowledgeBaseDocument,
  listKnowledgeBaseDocuments 
} from "@/app/lib/file-storage";
import { addDocuments } from "@/app/lib/vector-store";
import path from 'path';
import fs from 'fs/promises';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (filename) {
      const document = await getKnowledgeBaseDocument(filename);
      return NextResponse.json(document);
    }

    const documents = await listKnowledgeBaseDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error retrieving documents:", error);
    return NextResponse.json(
      { error: "Failed to retrieve documents" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Delete from file storage
    const filepath = path.join('data', 'knowledge_base', filename);
    await fs.unlink(filepath);
    
    // Delete metadata file if it exists
    const metadataPath = `${filepath}.meta.json`;
    try {
      await fs.unlink(metadataPath);
    } catch (error) {
      // Ignore error if metadata file doesn't exist
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
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
    await addDocuments(content, {
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