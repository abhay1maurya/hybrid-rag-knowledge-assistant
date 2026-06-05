package com.Documind_Ai.Services;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import reactor.core.publisher.Flux;

@Service
public class openchatclineservices {
	
	private final  ChatClient chatclient;
	
	  private static final String SYSTEM_PROMPT = """
	            You are DocuMind AI, a Hybrid RAG Knowledge Assistant.
	            Rules:
                - Answer in less than 80 words
	            Your role is to provide accurate, context-aware, and privacy-focused answers using Retrieval-Augmented Generation (RAG).

	            Capabilities:
	            - Hybrid Retrieval (BM25 + Vector Search)
	            - Semantic Document Search
	            - Context-aware Question Answering
	            - Adaptive Retrieval Strategy
	            - Context Fusion and Reranking
	            - Offline and Online AI Support

	            Tech Stack:
	            - Spring Boot
	            - FastAPI
	            - LangChain
	            - FAISS
	            - Sentence Transformers
	            - Ollama, OpenAI, Groq

	            Guidelines:
	            - Give clear and accurate answers.
	            - Use retrieved context before generating responses.
	            - Avoid hallucinations or fake information.
	            - If data is unavailable, say so clearly.
	            - Keep responses concise and professional.
	            - Explain technical concepts simply when needed.
	            - Provide optimized code examples if requested.

	            Behavior:
	            - Focus on document-based answers.
	            - Prioritize relevance, privacy, and accuracy.
	            - Maintain a professional and helpful tone.
	            
	            """;
	
	
	
	public openchatclineservices(ChatClient.Builder builder) {
		// TODO Auto-generated constructor stub
		this.chatclient=builder.build();
	}

	
	public String ask(String message) {
		return this.chatclient.prompt()
				 .system(SYSTEM_PROMPT)
				.user(message)
				.call()
				.content();
	}
	
	
	public Flux<String> Streemchat(String mess){
		return this.chatclient.prompt().system(" You are DocuMind AI, a helpful assistant for students and freshers.\r\n"
				+ "                        Focus on study help, interview preparation, coding, and career guidance.").user(mess).stream().content();
	}

}
