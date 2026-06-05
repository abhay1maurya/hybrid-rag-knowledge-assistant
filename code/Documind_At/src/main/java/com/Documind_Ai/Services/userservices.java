package com.Documind_Ai.Services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.PathVariable;

import com.Documind_Ai.model.User;
import com.Documind_Ai.repository.userrepository;

@Service
public class userservices {
	
	@Autowired
	userrepository userepo;
	
	public boolean datasave(User user) {
		try {
			userepo.save(user);
			return true;
		} catch (Exception e) {
			// TODO: handle exception
			System.out.println(e.getMessage());
		}

		return false;
	}
	
	public User findByUsername(String email) {
		return this.userepo.findByEmail(email).orElse(null);
	}
	
	
}
