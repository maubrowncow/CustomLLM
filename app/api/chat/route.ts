import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { similaritySearch } from '@/app/lib/vector-store';
import { getLatestInstructions } from '@/app/lib/file-storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages, instructions } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get the latest instructions from file storage
    const savedInstructions = await getLatestInstructions();
    const finalInstructions = instructions || savedInstructions;

    // Get relevant context from vector store
    let context = '';
    try {
      const lastMessage = messages[messages.length - 1];
      const results = await similaritySearch(lastMessage.content);
      if (results.length > 0) {
        context = results
          .map((result) => `[Score: ${result.score.toFixed(2)}] ${result.text}`)
          .join('\n\n');
      }
    } catch (error) {
      console.error('Error retrieving context:', error);
      // Continue without context if there's an error
    }

    // Construct system message with context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant. ${
        finalInstructions ? `\n\nCustom Instructions:\n${finalInstructions}` : ""
      }${
        context
          ? `\n\nRelevant Context:\n${context}`
          : ""
      }`,
    };

    // Get completion from OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseMessage = completion.choices[0].message;

    return NextResponse.json({
      message: {
        role: 'assistant',
        content: responseMessage.content || ''
      },
      hasContext: context.length > 0,
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 