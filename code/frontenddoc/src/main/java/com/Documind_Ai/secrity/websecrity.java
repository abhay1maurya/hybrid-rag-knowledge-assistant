package com.Documind_Ai.secrity;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class websecrity {
	
	@Autowired
	CustomUserDetailsService customUserDetailsService;
	
	@Autowired
	private CustomOAuth2UserService customOAuth2UserService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/loginpage",
                    "/signup",
                    "/css/**",
                    "/js/**",
                    "/imag/**",
                    "/landingpage",
                    "/",
                    "/about",
                    "/faq",
                    "/submiting",
                    "/generatedOtp",
                    "/verifyOtp",
                    "/sussregister",
                    "/subdata",
                    "/pricinglagacy",
                    "/features"
                ).permitAll()
//                .requestMatchers("/**").hasRole("USER")
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                    .loginPage("/loginpage")
                    .loginProcessingUrl("/login")
                    .usernameParameter("email")
                    .passwordParameter("password")
                    .defaultSuccessUrl("/dashboard", true)
                    .failureUrl("/loginpage?error=true")
            )
            .oauth2Login(oauth->oauth
            		.loginPage("/loginpage")
                    .userInfoEndpoint(userInfo ->
                        userInfo.userService(customOAuth2UserService)
                    )
                    .defaultSuccessUrl("/dashboard", true)
            		)
            .logout(logout -> logout
                .logoutSuccessUrl("/loginpage?logout=true")
                .permitAll()
            );

        return http.build();
    }
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return NoOpPasswordEncoder.getInstance();
    }
    
    
    @Bean
    AuthenticationManager authenticationManager(
            AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
    
    
    
    
    
    
    
    
}