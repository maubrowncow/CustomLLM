'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  useDisclosure,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Textarea,
  Flex,
  useColorModeValue,
  Container,
  Heading,
  Divider,
  Tooltip,
  Badge,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  List,
  ListItem,
  Progress,
  useDisclosure as useDisclosure2,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
} from '@chakra-ui/react';
import { FiSettings, FiSend, FiFile, FiInfo, FiUpload, FiTrash2, FiFolder, FiFileText } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Document {
  name: string;
  path: string;
  type: string;
  size: number;
  lastModified: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isUploadOpen, onOpen: onUploadOpen, onClose: onUploadClose } = useDisclosure2();
  const [instructions, setInstructions] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure();

  // Load saved messages and instructions from localStorage only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('messages');
      if (savedMessages) {
        try {
          setMessages(JSON.parse(savedMessages));
        } catch (e) {
          console.error('Error parsing saved messages:', e);
        }
      }
      
      const savedInstructions = localStorage.getItem('instructions');
      if (savedInstructions) {
        setInstructions(savedInstructions);
      }
    }
  }, []);

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const userMessageBg = useColorModeValue('blue.500', 'blue.400');
  const assistantMessageBg = useColorModeValue('gray.100', 'gray.700');

  // Save messages to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('instructions', instructions);
    // Save instructions to server
    const saveToServer = async () => {
      try {
        await fetch('/api/instructions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions }),
        });
      } catch (error) {
        console.error('Error saving instructions:', error);
        toast({
          title: 'Error',
          description: 'Failed to save instructions to server',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };
    saveToServer();
  }, [instructions, toast]);

  // Load instructions from server on mount
  useEffect(() => {
    const loadInstructions = async () => {
      try {
        const response = await fetch('/api/instructions');
        if (response.ok) {
          const data = await response.json();
          if (data.instructions) {
            setInstructions(data.instructions);
          }
        }
      } catch (error) {
        console.error('Error loading instructions:', error);
      }
    };
    loadInstructions();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsIndexing(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      toast({
        title: 'Success',
        description: 'Documents uploaded and indexed successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh the documents list after upload
      await fetchDocuments();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsIndexing(false);
      setUploadProgress(0);
      onUploadClose();
    }
  };

  const handlePreviewDocument = async (path: string, name: string) => {
    try {
      const response = await fetch(`/api/documents?filename=${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewContent(data.content);
        setPreviewTitle(name);
        onPreviewOpen();
      } else {
        setPreviewContent('Failed to load document content.');
        setPreviewTitle(name);
        onPreviewOpen();
      }
    } catch (error) {
      setPreviewContent('Error loading document content.');
      setPreviewTitle(name);
      onPreviewOpen();
    }
  };

  const handleDeleteDocument = async (path: string, name: string) => {
    try {
      const response = await fetch(`/api/documents?filename=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          instructions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      if (data.message && typeof data.message.content === 'string') {
        setMessages(prev => [...prev, data.message]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('messages');
      // Don't clear instructions as they are part of the configuration
    }
  };

  return (
    <Box h="100vh" bg={useColorModeValue('gray.50', 'gray.900')}>
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-xl font-semibold">Vector RAG Chat</h1>
        <div className="flex space-x-4">
          <Link href="/document-viewer" className="text-blue-500 hover:text-blue-700">
            Document Viewer
          </Link>
          <Link href="/count-test" className="text-blue-500 hover:text-blue-700">
            Word Counter
          </Link>
        </div>
      </div>
      
      <Container maxW="container.xl" h="full" py={4}>
        <Flex direction="column" h="full" bg={bgColor} borderRadius="xl" boxShadow="lg" overflow="hidden">
          {/* Header */}
          <Flex
            p={4}
            borderBottom="1px"
            borderColor={borderColor}
            justify="space-between"
            align="center"
            bg={useColorModeValue('white', 'gray.800')}
          >
            <Heading size="md">Custom GPT</Heading>
            <HStack spacing={4}>
              <Tooltip label="Clear Chat">
                <IconButton
                  aria-label="Clear Chat"
                  icon={<FiTrash2 />}
                  variant="ghost"
                  onClick={clearChat}
                />
              </Tooltip>
              <Tooltip label="Settings">
                <IconButton
                  aria-label="Settings"
                  icon={<FiSettings />}
                  onClick={onOpen}
                  variant="ghost"
                />
              </Tooltip>
            </HStack>
          </Flex>

          {/* Messages */}
          <VStack spacing={4} align="stretch" flex={1} overflowY="auto" p={4}>
            {messages.map((message, index) => (
              <Box
                key={index}
                alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
                maxW="80%"
              >
                <Box
                  bg={message.role === 'user' ? 'blue.500' : 'gray.100'}
                  color={message.role === 'user' ? 'white' : 'black'}
                  p={4}
                  borderRadius="lg"
                >
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </VStack>

          {/* Input */}
          <Box p={4} borderTop="1px" borderColor={borderColor} bg={bgColor}>
            <form onSubmit={handleSubmit}>
              <Flex direction="column">
                <Box position="relative">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    size="md"
                    minHeight="60px"
                    maxHeight="300px"
                    resize="vertical"
                    borderRadius="lg"
                    bg={useColorModeValue('white', 'gray.700')}
                    mb={2}
                    _focus={{
                      boxShadow: "0 0 0 1px #3182ce",
                      borderColor: "blue.500"
                    }}
                    onKeyDown={(e) => {
                      // Send on Enter, allow Shift+Enter for new line
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <Text 
                    position="absolute" 
                    right="2" 
                    bottom="3" 
                    fontSize="xs" 
                    color="gray.500"
                  >
                    Press Enter to send, Shift+Enter for new line
                  </Text>
                </Box>
                <Button
                  type="submit"
                  colorScheme="blue"
                  isLoading={isLoading}
                  rightIcon={<FiSend />}
                  alignSelf="flex-end"
                  px={8}
                >
                  Send
                </Button>
              </Flex>
            </form>
          </Box>
        </Flex>
      </Container>

      {/* Settings Drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">Settings</DrawerHeader>
          <DrawerBody>
            <Tabs>
              <TabList>
                <Tab>Instructions</Tab>
                <Tab>Knowledge Base</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <VStack spacing={6} align="stretch" py={4}>
                    <Box>
                      <Heading size="sm" mb={2}>Custom Instructions</Heading>
                      <Textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Enter your custom instructions here..."
                        minH="200px"
                        borderRadius="md"
                      />
                    </Box>
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={6} align="stretch" py={4}>
                    <Box>
                      <HStack justify="space-between" mb={4}>
                        <Heading size="sm">Knowledge Base</Heading>
                        <Button
                          leftIcon={<FiUpload />}
                          onClick={onUploadOpen}
                          size="sm"
                          colorScheme="blue"
                        >
                          Upload Documents
                        </Button>
                      </HStack>
                      
                      {isIndexing && (
                        <Box mb={4}>
                          <Text mb={2}>Indexing documents...</Text>
                          <Progress value={uploadProgress} size="sm" colorScheme="blue" />
                        </Box>
                      )}

                      <List spacing={3}>
                        {documents.map((doc) => (
                          <ListItem
                            key={doc.path || doc.name}
                            p={3}
                            borderWidth="1px"
                            borderRadius="md"
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <HStack>
                              <FiFileText />
                              <VStack align="start" spacing={0}>
                                <Text fontWeight="medium">{doc.name}</Text>
                                <Text fontSize="sm" color="gray.500">
                                  {formatFileSize(doc.size)} • {doc.type || 'Unknown'}
                                </Text>
                              </VStack>
                            </HStack>
                            <HStack>
                              <Button
                                size="sm"
                                variant="outline"
                                colorScheme="blue"
                                onClick={() => handlePreviewDocument(doc.path, doc.name)}
                              >
                                View
                              </Button>
                              <IconButton
                                aria-label="Delete document"
                                icon={<FiTrash2 />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handleDeleteDocument(doc.path, doc.name)}
                              />
                            </HStack>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={onUploadClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Documents</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>Select files to upload to your knowledge base</Text>
              <Input
                type="file"
                multiple
                accept=".txt,.md,.pdf,.docx"
                onChange={handleFileUpload}
                ref={fileInputRef}
                display="none"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<FiUpload />}
                colorScheme="blue"
                width="full"
              >
                Choose Files
              </Button>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onUploadClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="2xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{previewTitle}</ModalHeader>
          <ModalCloseButton />
          <ModalBody
            maxHeight="60vh"
            overflowY="auto"
            whiteSpace="pre-wrap"
            px={6}
            py={4}
          >
            {previewContent}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onPreviewClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 