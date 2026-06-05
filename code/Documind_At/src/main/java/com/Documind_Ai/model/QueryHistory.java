package com.Documind_Ai.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "query_history")
public class QueryHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long queryId;

    @Column(columnDefinition = "TEXT")
    private String queryText;

    @Column(columnDefinition = "TEXT")
    private String response;

    private LocalDateTime timestamp = LocalDateTime.now();

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

	public Long getQueryId() {
		return queryId;
	}

	public void setQueryId(Long queryId) {
		this.queryId = queryId;
	}

	public String getQueryText() {
		return queryText;
	}

	public void setQueryText(String queryText) {
		this.queryText = queryText;
	}

	public String getResponse() {
		return response;
	}

	public void setResponse(String response) {
		this.response = response;
	}

	public LocalDateTime getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(LocalDateTime timestamp) {
		this.timestamp = timestamp;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public QueryHistory(Long queryId, String queryText, String response, LocalDateTime timestamp, User user) {
		super();
		this.queryId = queryId;
		this.queryText = queryText;
		this.response = response;
		this.timestamp = timestamp;
		this.user = user;
	}

	public QueryHistory() {
		super();
		// TODO Auto-generated constructor stub
	}

    // getters & setters
    
    
}