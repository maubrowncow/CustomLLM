import { useState } from 'react';
import {
  Box,
  Button,
  Textarea,
  VStack,
  Text,
  useToast,
  Input,
  Heading,
} from '@chakra-ui/react';

export default function VectorStoreTest() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ text: string; score: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleIngest = async () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some text to ingest',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('Failed to ingest document');

      toast({
        title: 'Success',
        description: 'Document ingested successfully',
        status: 'success',
        duration: 3000,
      });
      setText('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to ingest document',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a search query',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error('Failed to perform search');

      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to perform search',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={4} maxW="800px" mx="auto">
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Vector Store Test</Heading>

        <Box>
          <Text mb={2}>Ingest Document</Text>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to ingest..."
            size="lg"
            rows={6}
          />
          <Button
            mt={2}
            colorScheme="blue"
            onClick={handleIngest}
            isLoading={isLoading}
          >
            Ingest
          </Button>
        </Box>

        <Box>
          <Text mb={2}>Search</Text>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query..."
            size="lg"
          />
          <Button
            mt={2}
            colorScheme="green"
            onClick={handleSearch}
            isLoading={isLoading}
          >
            Search
          </Button>
        </Box>

        {results.length > 0 && (
          <Box>
            <Text mb={2}>Search Results</Text>
            <VStack align="stretch" spacing={4}>
              {results.map((result, index) => (
                <Box
                  key={index}
                  p={4}
                  borderWidth={1}
                  borderRadius="md"
                  bg="gray.50"
                >
                  <Text fontWeight="bold">Score: {result.score.toFixed(4)}</Text>
                  <Text mt={2}>{result.text}</Text>
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
} 