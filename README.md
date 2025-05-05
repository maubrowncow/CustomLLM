# Vector RAG Foundation

A custom GPT-like application with RAG capabilities using LlamaIndex and a modern UI. This application allows you to create your own AI assistant with custom instructions and a knowledge base powered by vector search.

## Features

- Custom GPT-like interface
- RAG (Retrieval Augmented Generation) using LlamaIndex
- Vector database for large knowledge bases
- Support for nested folder structures in knowledge base
- Customizable instructions and settings
- Modern UI with Chakra UI

## Critical Features

### Data Persistence
- **Custom Instructions**: Automatically saved and restored
  - Stored in both browser and backend
  - Version controlled
  - Cross-device sync
- **Knowledge Base**: Permanent storage
  - Automatic backups
  - Version history
  - Integrity checks
- **State Management**: Persistent across sessions
  - Automatic recovery
  - Cross-device sync
  - Regular validation

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

3. Create a `knowledge_base` directory in the root folder and add your documents there.

4. Run the development server:
```bash
npm run dev
```

## Project Structure

- `/app` - Next.js application code
- `/knowledge_base` - Your custom knowledge base (create this directory)
- `/components` - React components
- `/lib` - Utility functions and LlamaIndex setup
- `/public` - Static assets

## Usage

1. Start the application and navigate to the settings panel
2. Configure your custom instructions
3. Add documents to the knowledge base directory
4. The system will automatically index new documents
5. Start chatting with your custom AI assistant

## Knowledge Base

The knowledge base supports various file formats and can be organized in nested folders. The system will automatically index all supported files in the knowledge base directory and its subdirectories.

Supported file formats:
- Text files (.txt)
- Markdown files (.md)
- PDF files (.pdf)
- Word documents (.docx)
- And more (see LlamaIndex documentation)

## Environment Variables
Required environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `CHROMA_SERVER_HOST`: ChromaDB server host (default: localhost)
- `CHROMA_SERVER_PORT`: ChromaDB server port (default: 8001)
- `DATABASE_URL`: For persistent storage
- `BACKUP_INTERVAL`: Automatic backup frequency 