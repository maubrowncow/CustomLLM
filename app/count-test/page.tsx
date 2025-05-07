'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CountTest() {
  const [term, setTerm] = useState('cocktail');
  const [document, setDocument] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('13');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Build the URL with query parameters
      const url = new URL('/api/count', window.location.origin);
      url.searchParams.append('term', term);
      
      if (document) {
        url.searchParams.append('document', document);
      }
      
      if (episodeNumber) {
        url.searchParams.append('episodeNumber', episodeNumber);
      }
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Word Count Tester</h1>
      <div className="flex justify-between mb-4">
        <p>Use this tool to count occurrences of any term in your knowledge base documents.</p>
        <div className="flex space-x-4">
          <Link href="/" className="text-blue-500 hover:underline">
            Back to Chat
          </Link>
          <Link href="/document-viewer" className="text-blue-500 hover:underline">
            Document Viewer
          </Link>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block mb-2">
            Term to count:
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="border p-2 w-full mt-1"
              required
            />
          </label>
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">
            Filter by document name (optional):
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="border p-2 w-full mt-1"
              placeholder="e.g., transcript.txt"
            />
          </label>
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">
            Filter by episode number (optional):
            <input
              type="text"
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(e.target.value)}
              className="border p-2 w-full mt-1"
              placeholder="e.g., 13"
            />
          </label>
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >
          {isLoading ? 'Counting...' : 'Count Occurrences'}
        </button>
      </form>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {results && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Results</h2>
          <p>
            Found <span className="font-bold">{results.totalCount}</span> occurrences of &quot;{results.term}&quot;
          </p>
          
          {results.results && results.results.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">File Breakdown:</h3>
              <ul className="list-disc pl-6">
                {results.results.map((result: any, index: number) => (
                  <li key={index} className="mb-4">
                    <p className="font-semibold">{result.file}: {result.count} occurrences</p>
                    {result.examples && result.examples.length > 0 && (
                      <div className="mt-2 ml-4">
                        <h4 className="font-medium mb-1">Examples:</h4>
                        <ul className="list-disc pl-4">
                          {result.examples.map((example: string, i: number) => (
                            <li key={i} className="text-sm text-gray-700 mb-1">
                              {example}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}