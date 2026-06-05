package com.Documind_Ai.secrity;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import com.Documind_Ai.model.User;
import com.Documind_Ai.repo.BackendAi;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    @Autowired
    private BackendAi userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request)
            throws OAuth2AuthenticationException {

        OAuth2User oauthUser = super.loadUser(request);

        String email = oauthUser.getAttribute("email");
        String name = oauthUser.getAttribute("name");

        User user = userRepository.findByUsername(email);

        if (user == null) {
            User newUser = new User();
            newUser.setName(name);
            newUser.setEmail(email);
            newUser.setRole("USER");

            userRepository.savedata(newUser);
        }

        return new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("USER")),
                oauthUser.getAttributes(),
                "email"
        );
    }
}