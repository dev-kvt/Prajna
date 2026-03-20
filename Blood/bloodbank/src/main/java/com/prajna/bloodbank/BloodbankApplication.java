package com.prajna.bloodbank;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class BloodbankApplication {

	public static void main(String[] args) {
		SpringApplication.run(BloodbankApplication.class, args);
	}

}
