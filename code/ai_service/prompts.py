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
        template="""You are a precise and helpful assistant.
Answer the question using ONLY the context provided below.
If the answer is not found in the context, respond with:
"I don't have enough information in the provided documents to answer this."
Do NOT use any prior knowledge or make assumptions beyond what is in the context.
Cite the page number after your answer like: [Source: page X]

Context:
{context}

Question: {question}

Answer:"""
    )