package com.Documind_Ai.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long docId;

    private String fileName;
    private String fileType;
    private String filePath;

    private LocalDateTime uploadDate = LocalDateTime.now();

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL)
    private List<ChunkMetadata> chunks;

	public Long getDocId() {
		return docId;
	}

	public void setDocId(Long docId) {
		this.docId = docId;
	}

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}

	public String getFileType() {
		return fileType;
	}

	public void setFileType(String fileType) {
		this.fileType = fileType;
	}

	public String getFilePath() {
		return filePath;
	}

	public void setFilePath(String filePath) {
		this.filePath = filePath;
	}

	public LocalDateTime getUploadDate() {
		return uploadDate;
	}

	public void setUploadDate(LocalDateTime uploadDate) {
		this.uploadDate = uploadDate;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public List<ChunkMetadata> getChunks() {
		return chunks;
	}

	public void setChunks(List<ChunkMetadata> chunks) {
		this.chunks = chunks;
	}

	public Document() {
		super();
		// TODO Auto-generated constructor stub
	}

	public Document(Long docId, String fileName, String fileType, String filePath, LocalDateTime uploadDate, User user,
			List<ChunkMetadata> chunks) {
		super();
		this.docId = docId;
		this.fileName = fileName;
		this.fileType = fileType;
		this.filePath = filePath;
		this.uploadDate = uploadDate;
		this.user = user;
		this.chunks = chunks;
	}

    // getters & setters
    
    
    
}
