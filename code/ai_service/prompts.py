from langchain_core.prompts import PromptTemplate

def get_condense_question_prompt() -> PromptTemplate:
    """Rephrases follow-up questions into standalone questions using chat history."""
    return PromptTemplate(
        input_variables=["chat_history", "question"],
        template="""Given the conversation history and a follow-up question,
rephrase the follow-up question to be a standalone question that contains
all necessary context.

Chat History:
{chat_history}

Follow-up Question: {question}

Standalone Question:"""
    )

def get_answer_prompt() -> PromptTemplate:
    """Prompt for final answer generation from retrieved context."""
    return PromptTemplate(
        input_variables=["context", "question"],
        template="""You are a precise, fact-based AI assistant.
Answer the user's question using ONLY the context provided below.

CRITICAL RULES:
1. If the answer cannot be determined from the context, state exactly: "I don't have enough information in the provided documents to answer this." Do not try to guess.
2. Do NOT use outside knowledge or make assumptions.
3. You MUST cite your source using the exact metadata tags provided within the context blocks below. Format your citation exactly like this at the end of your answer: [Source: Document Name/Page Number].
4. NEVER invent, guess, or hallucinate a page number or source name. If a specific context block does not have a source label, do not invent one.

Context:
{context}

Question: {question}

Answer:"""
    )