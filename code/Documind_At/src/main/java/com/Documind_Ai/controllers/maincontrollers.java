package com.Documind_Ai.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.Documind_Ai.Services.userservices;
import com.Documind_Ai.model.User;


@RestController
public class maincontrollers {
	
	
	@Autowired
	userservices servicesuser;
	@PostMapping("/savedata")
	public boolean savedata(@RequestBody User user) {
		return this.servicesuser.datasave(user);
	}
	
	@GetMapping("/findByUsername")
	public User findByUsername(@RequestParam("email") String email) {
		return this.servicesuser.findByUsername(email);
	}
	
	
	
	
}
