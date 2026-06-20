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
	
	
	public User createUser(User user) {

	    if(findByUsername(user.getEmail()) != null) {
	        throw new RuntimeException("Email already exists");
	    }

	    return userepo.save(user);
	}
	
	
	public User findByUsername(String email) {
		return this.userepo.findByEmail(email).orElse(null);
	}
	
	public User getUserById(Long userid) {
		return this.userepo.findByUserId(userid).orElse(null);
	}
	
	public User updateUser(Long id, User newUser) {
	    User old = this.userepo.findById(id).orElse(null);
	    if(old==null) {
	    	return null;
	    }
	    else {
	    	if(newUser.getName()!=null) {
	    		old.setName(newUser.getName());
	    	}
	    	if(newUser.getEmail()!=null) {
	    		old.setEmail(newUser.getEmail());
	    	}
	    	
	    	if(newUser.getPassword()!=null) {
	    		old.setPassword(newUser.getPassword());
	    	}
	    	if(newUser.getOtp()!=0) {
	    		old.setOtp(newUser.getOtp());
	    	}
	    	if(newUser.getRole()!=null) {
	    		old.setRole(newUser.getRole());
	    	}
	    	
	    }
	    return userepo.save(old);
	}
	
	
}
