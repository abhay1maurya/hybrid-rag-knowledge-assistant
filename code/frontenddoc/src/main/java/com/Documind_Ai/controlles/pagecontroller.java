package com.Documind_Ai.controlles;

import java.security.Principal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import com.Documind_Ai.model.User;
import com.Documind_Ai.repo.BackendAi;
import com.fasterxml.jackson.annotation.JsonCreator.Mode;

@Controller
public class pagecontroller {
	
	@Autowired
	BackendAi backendrepo;
	
	@GetMapping("/")
    public String home() {
        return "landingpage"; // index.html
    }

    @GetMapping("/features")
    public String features() {
        return "features"; // features.html
    }
   
    
    @GetMapping("/doclib")
    public String doclib(Principal prin , Model mo) {
    	String email =prin.getName();
    	User  user=this.backendrepo.findByUsername(email);
    	mo.addAttribute("u",user);
        return "doclib"; // features.html
    }
    @GetMapping("/faq")
    public String faq() {
        return "faq"; // faq.html
    }

    @GetMapping("/pricinglagacy")
    public String pricing() {
        return "pricinglagacy"; // pricinglagacy.html
    }
    
    
    @GetMapping("/pricing")
    public String pricinging() {
        return "pricinglagacy"; // pricinglagacy.html
    }

    @GetMapping("/dashboard" )
    public String dashboard(Principal prin, Model mo) {
    	System.out.print(prin.getName());
    	String email =prin.getName();
    	User  user=this.backendrepo.findByUsername(email);
    	mo.addAttribute("u",user);
        return "dashboard"; 
    }

    @GetMapping("/about")
    public String about() {
        return "about"; // about.html
    }

    @GetMapping("/settinglagacy")
    public String settings(Principal prin, Model mo) {
        String email = prin.getName();
        User user = this.backendrepo.findByUsername(email);
        mo.addAttribute("u", user);
        return "settinglagacy"; 
    }

    @GetMapping("/loginpage")
    public String loginpage() {
        return "loginpage"; // signup.html
    }
  
    @GetMapping("/profile")
    public String profilepage(Principal prin, Model mo) {
    	String email =prin.getName();
    	User  user=this.backendrepo.findByUsername(email);
    	mo.addAttribute("u",user);
        return "profile"; 
    }
    
    
    @GetMapping("/models")
    public String modelspage() {
        return "models"; // s
    }
    
    @GetMapping("/policies")
    public String policiespage() {
        return "policies"; // s
    }
    
    
    @GetMapping("/support")
    public String supportpage() {
        return "support"; // s
    }
    
    
    @GetMapping("/chat")
    public String chat(Principal prin , Model mo) {
    	System.out.print(prin.getName());
    	String email =prin.getName();
    	User  user=this.backendrepo.findByUsername(email);
    	mo.addAttribute("u",user);
    	return "chat";
    }

}
