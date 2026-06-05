package com.Documind_Ai.secrity;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestParam;

import com.Documind_Ai.model.User;
import com.Documind_Ai.repo.BackendAi;

@Service
public class CustomUserDetailsService implements UserDetailsService {

	@Autowired
    private  BackendAi repository;

    

	@Override
	public UserDetails loadUserByUsername(String email)
	        throws UsernameNotFoundException {

	    User user = repository.findByUsername(email);;

	    if (user == null) {
	        throw new UsernameNotFoundException(
	                "User not found: " + email);
	    }

	    return org.springframework.security.core.userdetails.User
	            .withUsername(user.getEmail())
	            .password(user.getPassword())
	            .roles(user.getRole())
	            .build();
	}
}
