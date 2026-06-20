package com.Documind_Ai.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import com.Documind_Ai.model.User;
import java.util.List;
import java.util.Optional;


@Repository
public interface userrepository extends JpaRepository<User, Long>{
	
	Optional<User> findByEmail(String email);
	Optional<User> findByUserId(Long userId);
	
 
}
