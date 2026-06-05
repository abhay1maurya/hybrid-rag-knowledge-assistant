package com.Documind_Ai.controlles;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.ResponseBody;

import com.Documind_Ai.model.User;
import com.Documind_Ai.repo.BackendAi;
import com.Documind_Ai.repo.aiservicesbackend;

@Controller
public class homecontrolles {
	
	@Autowired
	BackendAi backai;
	
	@Autowired
	aiservicesbackend aiservice;

	
	
	@GetMapping("/signup")
	public String signup( ) {
		
		return "signup";
	}
	
	
	@GetMapping("/submiting")
	public String signupsubmit(@ModelAttribute User user) {
		user.setRole("USER");
		user.setCreatedAt(LocalDateTime.now());
		this.backai.savedata(user);
		return "redirect:/loginpage";
	}
	
	
	@ResponseBody
    @GetMapping("/health")
    Map<String, Object> health(){
    	return this.aiservice.healthCheck();
    			}
	
	
	@ResponseBody
	 @GetMapping("/gogole")
    public String dashboard(
            @AuthenticationPrincipal OAuth2User user) {

        return "Hello " + user.getAttribute("name")
                + " Email: " + user.getAttribute("email");
    }
	
}
