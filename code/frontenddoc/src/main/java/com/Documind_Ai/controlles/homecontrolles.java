package com.Documind_Ai.controlles;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.Documind_Ai.model.User;
import com.Documind_Ai.repo.BackendAi;
import com.Documind_Ai.repo.EmailService;
import com.Documind_Ai.repo.aiservicesbackend;

import jakarta.servlet.http.HttpSession;

@Controller
public class homecontrolles {
	
	@Autowired
	BackendAi backai;
	
	@Autowired
	aiservicesbackend aiservice;

	@Autowired
	EmailService emailService;
	
	
	@GetMapping("/signup")
	public String signup( ) {
		
		return "signup";
	}
	
	@PostMapping("/generatedOtp")
	@ResponseBody
	public Map<String, String> generateOtp(
	        @ModelAttribute User userentiy,
	        HttpSession session) {

	    if (userentiy.getEmail() == null || userentiy.getEmail().isBlank()) {
	        return Map.of("status", "EMAIL_NULL");
	    }

	    SecureRandom random = new SecureRandom();
	    int otp = 1000 + random.nextInt(9000);

	    // ✅ SAVE OTP IN ENTITY
	    userentiy.setOtp(otp);
	    userentiy.setRole("USER");

	    // send mail
	    emailService.sendRegistrationEmail(
	            userentiy.getEmail(), otp, userentiy.getPassword());

	    // save user
	    User user = backai.createUser(userentiy);

	    return Map.of(
	            "status", "OTP_SENT",
	            "userid", String.valueOf(user.getUserId())
	    );
	}

	
	@PostMapping("/verifyOtp")
	@ResponseBody
	public Map<String, String> verifyOtp(
	        @RequestParam("userid") Long userid,
	        @RequestParam("userotp") String userotp) {

	    User user = this.backai.getUserById(userid);

	    if (user == null) {
	        return Map.of("status", "INVALID");
	    }

	    int savedOtp = user.getOtp();

	    // ✅ CORRECT OTP CHECK
	    if (String.valueOf(savedOtp).equals(userotp)) {
	        return Map.of("status", "VERIFIED");
	    } else {
	        return Map.of("status", "INVALID");
	    }
	}

	
	
	@PostMapping("/sussregister")
	@ResponseBody
	public String sussregister(@ModelAttribute User userEntity) {
		
		User u=this.backai.updateUser(userEntity.getUserId(), userEntity);
	    return "done"+u.toString();
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
