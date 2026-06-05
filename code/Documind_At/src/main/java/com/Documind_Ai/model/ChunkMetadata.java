package com.Documind_Ai.model;

import jakarta.persistence.*;

@Entity
@Table(name = "chunk_metadata")
public class ChunkMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long chunkId;

    @Column(columnDefinition = "TEXT")
    private String chunkText;

    private String embeddingId;

    @ManyToOne
    @JoinColumn(name = "doc_id")
    private Document document;

	public Long getChunkId() {
		return chunkId;
	}

	public void setChunkId(Long chunkId) {
		this.chunkId = chunkId;
	}

	public String getChunkText() {
		return chunkText;
	}

	public void setChunkText(String chunkText) {
		this.chunkText = chunkText;
	}

	public String getEmbeddingId() {
		return embeddingId;
	}

	public void setEmbeddingId(String embeddingId) {
		this.embeddingId = embeddingId;
	}

	public Document getDocument() {
		return document;
	}

	public void setDocument(Document document) {
		this.document = document;
	}

	public ChunkMetadata(Long chunkId, String chunkText, String embeddingId, Document document) {
		super();
		this.chunkId = chunkId;
		this.chunkText = chunkText;
		this.embeddingId = embeddingId;
		this.document = document;
	}

	public ChunkMetadata() {
		super();
		// TODO Auto-generated constructor stub
	}

    // getters & setters
    
    
    
}
