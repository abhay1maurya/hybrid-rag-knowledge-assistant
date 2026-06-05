package com.Documind_Ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class FrontenddocApplication {

	public static void main(String[] args) {
		SpringApplication.run(FrontenddocApplication.class, args);
	}

}
