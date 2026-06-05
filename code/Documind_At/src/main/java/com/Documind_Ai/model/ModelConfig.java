package com.Documind_Ai.model;

import jakarta.persistence.*;

@Entity
@Table(name = "model_config")
public class ModelConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long configId;

    private String mode;        // online / offline
    private String modelName;
    private String apiKey;
	public Long getConfigId() {
		return configId;
	}
	public void setConfigId(Long configId) {
		this.configId = configId;
	}
	public String getMode() {
		return mode;
	}
	public void setMode(String mode) {
		this.mode = mode;
	}
	public String getModelName() {
		return modelName;
	}
	public void setModelName(String modelName) {
		this.modelName = modelName;
	}
	public String getApiKey() {
		return apiKey;
	}
	public void setApiKey(String apiKey) {
		this.apiKey = apiKey;
	}
	public ModelConfig(Long configId, String mode, String modelName, String apiKey) {
		super();
		this.configId = configId;
		this.mode = mode;
		this.modelName = modelName;
		this.apiKey = apiKey;
	}
	public ModelConfig() {
		super();
		// TODO Auto-generated constructor stub
	}

    // getters & setters
    
    
    
    
}
