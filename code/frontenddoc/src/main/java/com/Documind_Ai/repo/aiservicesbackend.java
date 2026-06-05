package com.Documind_Ai.repo;




import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.cloud.openfeign.FeignClientProperties.FeignClientConfiguration;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.List;

@FeignClient(
    name = "documind-ai-service",
    url = "${fastapi.base-url:http://localhost:8000}",
    configuration = FeignClientConfiguration.class
)
public interface aiservicesbackend {

    // ==========================================
    // DEFAULT
    // ==========================================

    @GetMapping("/")
    Map<String, Object> readRoot();

    @GetMapping("/health")
    Map<String, Object> healthCheck();

    @GetMapping("/supported-formats")
    List<String> getSupportedFormats();

    @GetMapping("/provider")
    Map<String, Object> getProvider();

    @PostMapping("/provider/switch")
    Map<String, Object> switchProvider(@RequestBody Map<String, Object> request);

    @PostMapping("/reset")
    Map<String, Object> resetSession(@RequestBody Map<String, Object> request);

    // Requires spring-cloud-starter-openfeign and proper FormEncoder bean config to work
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    Map<String, Object> uploadFile(
        @RequestPart("user_id") String userId,
        @RequestPart("file") MultipartFile file
    );

    // MUST be sent as form-urlencoded, NOT JSON body.
    @PostMapping(value = "/ask", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    Map<String, Object> askQuestion(
        @RequestParam("query") String query,
        @RequestParam("user_id") String userId
    );

    @GetMapping("/ask/stream")
    String askStream(@RequestParam("query") String query, @RequestParam("user_id") String userId);


    // ==========================================
    // CONFIGURATION
    // ==========================================

    @GetMapping("/config/options")
    Map<String, Object> getAllOptions();

    @GetMapping("/config/{user_id}")
    Map<String, Object> getConfig(@PathVariable("user_id") String userId);

    @PatchMapping("/config/{user_id}")
    Map<String, Object> updateConfig(
        @PathVariable("user_id") String userId, 
        @RequestBody Map<String, Object> configUpdate
    );

    @PostMapping("/config/{user_id}/reset")
    Map<String, Object> resetConfig(@PathVariable("user_id") String userId);

    @GetMapping("/config/{user_id}/llm-models")
    List<Map<String, Object>> getAvailableModelsForProvider(@PathVariable("user_id") String userId);


    // ==========================================
    // DOCUMENT MANAGEMENT
    // ==========================================

    @GetMapping("/documents/{user_id}")
    List<Map<String, Object>> listUserDocuments(@PathVariable("user_id") String userId);

    @DeleteMapping("/documents/{user_id}")
    Map<String, Object> deleteAllUserDocuments(@PathVariable("user_id") String userId);

    @GetMapping("/documents/{user_id}/stats")
    Map<String, Object> userStorageStats(@PathVariable("user_id") String userId);

    @GetMapping("/documents/{user_id}/{doc_id}")
    Map<String, Object> documentDetail(
        @PathVariable("user_id") String userId, 
        @PathVariable("doc_id") String docId
    );

    @DeleteMapping("/documents/{user_id}/{doc_id}")
    Map<String, Object> deleteSingleDocument(
        @PathVariable("user_id") String userId, 
        @PathVariable("doc_id") String docId
    );


    // ==========================================
    // EVALUATION
    // ==========================================

    @GetMapping("/eval/{user_id}/test-set")
    List<Map<String, Object>> getUserTestSet(@PathVariable("user_id") String userId);

    @DeleteMapping("/eval/{user_id}/test-set")
    Map<String, Object> clearUserTestSet(@PathVariable("user_id") String userId);

    @PostMapping("/eval/{user_id}/test-set/add")
    Map<String, Object> addTestQuestion(
        @PathVariable("user_id") String userId, 
        @RequestBody Map<String, Object> addQuestionRequest
    );

    @DeleteMapping("/eval/{user_id}/test-set/{q_id}")
    Map<String, Object> deleteTestQuestion(
        @PathVariable("user_id") String userId, 
        @PathVariable("q_id") String questionId
    );

    @PostMapping("/eval/{user_id}/test-set/auto-generate")
    Map<String, Object> autoGenerateTestQuestions(@PathVariable("user_id") String userId);

    @PostMapping("/eval/{user_id}/run")
    Map<String, Object> runUserEvaluation(@PathVariable("user_id") String userId);

    @GetMapping("/eval/{user_id}/results")
    List<Map<String, Object>> getEvaluationResults(@PathVariable("user_id") String userId);

    @DeleteMapping("/eval/{user_id}/results")
    Map<String, Object> clearEvaluationHistory(@PathVariable("user_id") String userId);

    @GetMapping("/eval/{user_id}/results/latest")
    Map<String, Object> getLatestEvaluation(@PathVariable("user_id") String userId);

    @GetMapping("/eval/{user_id}/summary")
    Map<String, Object> getEvaluationSummary(@PathVariable("user_id") String userId);
}
