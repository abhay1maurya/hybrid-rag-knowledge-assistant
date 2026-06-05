package com.Documind_Ai.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.Documind_Ai.Services.openchatclineservices;
import org.springframework.http.MediaType;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/ai")
@CrossOrigin(origins = "*")
public class ChatController {
	
	@Autowired
	openchatclineservices ChatClient;
	
	
//////	You are an agriculture expert. Answer using Indian farming conditions.
	@GetMapping("/demo")
	public String agricultureAI(@RequestParam ("q") String question) {
		return ChatClient.ask(question);
	}
	
	@GetMapping(
		    value = "/ask",
		    produces = MediaType.TEXT_EVENT_STREAM_VALUE
		)
	public Flux<String> steemchat(@RequestParam ("q") String question){
		return ChatClient.Streemchat(question);
	}
	
	
	
	
	

}
