# DocuMind AI

DocuMind AI is a Hybrid Retrieval-Augmented Generation (RAG) Knowledge Assistant that allows users to upload documents and query them using natural language.

The system retrieves relevant information from documents and generates contextual responses using AI models.

## Features

- Document upload (PDF, DOCX, TXT)
- Semantic search using vector embeddings
- AI-powered question answering
- Hybrid AI support (online + offline models)
- Chat-based interface
- Document source citations

## Tech Stack

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Java
- Spring Boot
- REST APIs

AI Components:
- Retrieval-Augmented Generation (RAG)
- Vector embeddings
- Local LLMs (offline mode)
- Cloud LLMs (online mode)

Database:
- MySQL / PostgreSQL
- Vector Database (FAISS / Chroma)

## Architecture

User → Frontend → Spring Boot API → RAG Pipeline → Vector Database → LLM → Response

## Project Structure

frontend/ → Web interface  
backend/ → Spring Boot API  
ai-service/ → Embeddings & LLM logic  
database/ → SQL schema  
docs/ → Project documentation

## Future Improvements

- Multilingual support
- Voice interaction
- Mobile application
- Advanced retrieval algorithms