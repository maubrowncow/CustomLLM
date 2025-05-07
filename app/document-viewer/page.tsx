'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DocumentViewer() {
  const [documentName, setDocumentName] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('13');
  const [analyze, setAnalyze] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [document, setDocument] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{index: number, text: string}[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Fetch available documents on component mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents');
        if (response.ok) {
          const data = await response.json();
          if (data.documents) {
            setDocuments(data.documents);
          }
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };
    
    fetchDocuments();
  }, []);
  
  // Function to load a document by name
  const loadDocument = (name: string) => {
    setDocumentName(name);
    setEpisodeNumber('');
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDocument(null);
    setSearchResults([]);
    
    try {
      // Build the URL with query parameters
      const url = new URL('/api/documents', window.location.origin);
      
      if (documentName) {
        url.searchParams.append('document', documentName);
      }
      
      if (episodeNumber && !documentName) {
        url.searchParams.append('episodeNumber', episodeNumber);
      }
      
      if (analyze) {
        url.searchParams.append('analyze', 'true');
      }
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSearch = () => {
    if (!searchTerm || !document) return;
    
    const term = searchTerm.toLowerCase();
    const results: {index: number, text: string}[] = [];
    
    if (document.analysis && document.analysis.blocks) {
      document.analysis.blocks.forEach((block: any, blockIndex: number) => {
        const matchingLines = block.text.filter((line: string) => 
          line.toLowerCase().includes(term)
        );
        
        if (matchingLines.length > 0) {
          results.push({
            index: blockIndex,
            text: `[${block.timestamp}] ${matchingLines[0]}${matchingLines.length > 1 ? ` (+ ${matchingLines.length - 1} more)` : ''}`
          });
        }
      });
    } else if (document.content) {
      // If no structured blocks, search raw content
      const lines = document.content.split('\n');
      lines.forEach((line: string, index: number) => {
        if (line.toLowerCase().includes(term)) {
          results.push({
            index,
            text: line.trim()
          });
        }
      });
    }
    
    setSearchResults(results);
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Document Viewer</h1>
      
      <div className="flex justify-between mb-4">
        <p>Browse and analyze full documents in your knowledge base</p>
        <div className="flex space-x-4">
          <Link href="/" className="text-blue-500 hover:underline">
            Back to Chat
          </Link>
          <Link href="/count-test" className="text-blue-500 hover:underline">
            Go to Word Counter
          </Link>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Available Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div 
              key={doc.name} 
              className="border p-3 rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => loadDocument(doc.name)}
            >
              <div className="font-medium mb-1">{doc.name}</div>
              <div className="text-sm text-gray-600">
                {Math.round(doc.size / 1024)} KB • {new Date(doc.lastModified).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <h2 className="text-lg font-semibold mb-2">Document Search</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block mb-2">
            Document name (optional):
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="border p-2 w-full mt-1"
              placeholder="e.g., transcript.txt"
            />
          </label>
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">
            Episode number (optional, used if document name not provided):
            <input
              type="text"
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(e.target.value)}
              className="border p-2 w-full mt-1"
              placeholder="e.g., 13"
            />
          </label>
        </div>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={analyze}
              onChange={(e) => setAnalyze(e.target.checked)}
              className="mr-2"
            />
            Analyze document content (extract topics, timestamps, etc.)
          </label>
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >
          {isLoading ? 'Loading...' : 'View Document'}
        </button>
      </form>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {document && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Document: {document.file}</h2>
          <div className="text-sm text-gray-600 mb-4">
            Size: {Math.round(document.size / 1024)} KB | 
            Last modified: {new Date(document.lastModified).toLocaleString()}
          </div>
          
          {document.analysis && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Document Analysis</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium mb-2">Statistics</h4>
                  <ul>
                    {document.analysis.lineCount && <li>Lines: {document.analysis.lineCount}</li>}
                    {document.analysis.wordCount && <li>Words: {document.analysis.wordCount}</li>}
                    {document.analysis.timeBlocks && <li>Time blocks: {document.analysis.timeBlocks}</li>}
                    {document.analysis.sections && <li>Sections: {document.analysis.sections.length}</li>}
                    <li>Type: {document.analysis.type || 'Unknown'}</li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium mb-2">Top Terms</h4>
                  <div className="flex flex-wrap gap-2">
                    {document.analysis.topTerms && document.analysis.topTerms.slice(0, 12).map((term: any) => (
                      <span 
                        key={term.term} 
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        title={`${term.count} occurrences`}
                      >
                        {term.term} ({term.count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Show different content based on document type */}
              {document.analysis.type === 'markdown' && (
                <div className="mb-4">
                  {/* Authors section for markdown */}
                  {document.analysis.authors && document.analysis.authors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Authors & References</h4>
                      <div className="bg-purple-50 p-3 rounded">
                        <ul className="list-disc pl-5">
                          {document.analysis.authors.map((author: string, index: number) => (
                            <li key={index} className="mb-1">{author}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {/* Quotes section for markdown */}
                  {document.analysis.quotes && document.analysis.quotes.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Quotes & Key Insights</h4>
                      <div className="bg-yellow-50 p-3 rounded space-y-2">
                        {document.analysis.quotes.map((quote: string, index: number) => (
                          <blockquote key={index} className="border-l-4 border-yellow-300 pl-3 italic">
                            {quote}
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Key points section for markdown */}
                  {document.analysis.keyPoints && document.analysis.keyPoints.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Key Points</h4>
                      <div className="bg-green-50 rounded divide-y divide-green-100">
                        {document.analysis.keyPoints.map((point: any, index: number) => (
                          <div key={index} className="p-3">
                            <div className="font-medium text-green-800 mb-1">{point.title}</div>
                            <p className="text-sm text-gray-700">{point.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Document sections outline for markdown */}
                  {document.analysis.sections && document.analysis.sections.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Document Outline</h4>
                      <div className="bg-gray-100 p-3 rounded">
                        <ul className="space-y-1">
                          {document.analysis.sections.map((section: any, index: number) => (
                            <li 
                              key={index}
                              className={`pl-${Math.min(section.level * 3, 12)}`}
                              style={{ paddingLeft: `${section.level * 0.5}rem` }}
                            >
                              {section.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Main Topics section for transcripts */}
              {document.analysis.type === 'transcript' && document.analysis.mainTopics && document.analysis.mainTopics.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Main Topics</h4>
                  <div className="bg-blue-50 rounded divide-y divide-blue-100">
                    {document.analysis.mainTopics.map((topic: any, index: number) => (
                      <div key={index} className="p-3">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-medium text-blue-800">{topic.title}</span>
                          <span className="text-xs text-gray-500">[{topic.timestamp}]</span>
                        </div>
                        <p className="text-sm text-gray-700">{topic.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mb-4">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in document"
                    className="border p-2 flex-grow"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                  >
                    Search
                  </button>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Search Results ({searchResults.length})</h4>
                    <ul className="bg-yellow-50 p-2 rounded max-h-60 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <li key={index} className="mb-1 pb-1 border-b border-yellow-100">
                          {result.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Content Blocks section (only for transcripts) */}
              {document.analysis.type === 'transcript' && (
                <>
                  <h4 className="font-medium mb-2">Content Blocks</h4>
                  <div className="bg-white border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {document.analysis.blocks && document.analysis.blocks.map((block: any, index: number) => (
                      <div 
                        key={index} 
                        className="p-3 border-b border-gray-200 hover:bg-gray-50"
                      >
                        <div className="font-medium text-gray-700 mb-1">
                          [{block.timestamp}]
                        </div>
                        {block.text.map((line: string, lineIndex: number) => (
                          <p key={lineIndex} className="text-sm">
                            {line}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {/* Section content (only for markdown) */}
              {document.analysis.type === 'markdown' && document.analysis.fullSections && (
                <>
                  <h4 className="font-medium mb-2">Section Content</h4>
                  <div className="bg-white border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {document.analysis.fullSections.map((section: any, index: number) => (
                      <div 
                        key={index} 
                        className="p-3 border-b border-gray-200 hover:bg-gray-50"
                      >
                        <div className="font-medium text-gray-700 mb-1">
                          {section.title}
                        </div>
                        <div className="prose prose-sm">
                          {section.content.map((line: string, lineIndex: number) => (
                            <p key={lineIndex} className="text-sm">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          {!document.analysis && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Document Content</h3>
              <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">
                {document.content}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 