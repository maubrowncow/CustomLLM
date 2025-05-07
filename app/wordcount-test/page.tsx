'use client';

import { useState } from 'react';

export default function WordCountTest() {
  const [term, setTerm] = useState('cocktail');
  const [specificFile, setSpecificFile] = useState('Diggnation E013_transcript.txt');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const response = await fetch('/api/wordcount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ term, specificFile: specificFile || undefined }),
      });
      
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
      <h1 className="text-2xl font-bold mb-4">Word Count Test</h1>
      
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
            Specific file (optional):
            <input
              type="text"
              value={specificFile}
              onChange={(e) => setSpecificFile(e.target.value)}
              className="border p-2 w-full mt-1"
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
            Found <span className="font-bold">{results.total}</span> occurrences of &quot;{results.term}&quot;
            {specificFile && ` in file matching "${specificFile}"`}
          </p>
          
          {results.files && results.files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">File Breakdown:</h3>
              <ul className="list-disc pl-6">
                {results.files.map((file: any, index: number) => (
                  <li key={index} className="mb-4">
                    <p className="font-semibold">{file.fileName}: {file.count} occurrences</p>
                    {file.examples && file.examples.length > 0 && (
                      <div className="mt-2 ml-4">
                        <h4 className="font-medium mb-1">Examples:</h4>
                        <ul className="list-disc pl-4">
                          {file.examples.map((example: string, i: number) => (
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