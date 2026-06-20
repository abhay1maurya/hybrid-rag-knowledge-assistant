package com.Documind_Ai.repo;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import com.Documind_Ai.model.User;



@Service
@FeignClient(name = "documind-at", url = "http://localhost:8081")
public interface BackendAi {
	
	@PostMapping("/savedata")
	public boolean savedata(@RequestBody User user);
	
//	@GetMapping("/users/{id}")
//    User getUserById(@PathVariable Long id);
	
	
	@GetMapping("/findByUsername")
	public User findByUsername(@RequestParam("email") String email);
	
	@PostMapping("/createUser")
	public User createUser(@RequestBody User user);
	
	@GetMapping("/User/byid/{id}")
	public User getUserById(@PathVariable("id") Long id);
	
	
	@PutMapping("/User/update/{id}")
	public User updateUser(@PathVariable("id") Long id, @RequestBody User newUser);
}
