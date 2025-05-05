#!/bin/bash

# Create a directory for ChromaDB data if it doesn't exist
mkdir -p .chroma

# Start ChromaDB server on port 8001
chroma run --path .chroma --port 8001 