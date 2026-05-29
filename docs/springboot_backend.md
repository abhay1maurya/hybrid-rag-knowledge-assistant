Spring Boot Backend
===================

Overview
--------

This project primarily implements the RAG AI service in Python (FastAPI) under `code/ai_service` and a static web demo in `code/frontend`.

The Spring Boot Backend is an optional Java-based website backend that can be used to:
- Serve the frontend static assets (HTML/CSS/JS)
- Provide user authentication and session management
- Proxy and aggregate API requests to the RAG service (`code/ai_service`) and other microservices
- Expose site-specific admin APIs (provider switching, user management)

When to use
-----------

Use a Spring Boot backend when you want a JVM-based server for the website (familiar enterprise tooling, Spring Security, integrated DB access, or existing Java infra). The Spring Boot app typically runs separately from the Python RAG service and communicates with it over HTTP.

Responsibilities
----------------

- Static file hosting: map `/` and `/static/**` to bundled frontend files.
- Authentication: implement login/logout and issue session cookies or JWTs.
- Proxy endpoints: forward requests under `/api/ai/*` to the FastAPI service (e.g., `http://localhost:8000/*`).
- Admin APIs: protected endpoints for `POST /provider/switch` and other operational tasks.
- Health checks: Kubernetes-ready `/actuator/health` or custom `/health` that checks both the Spring service and the RAG backend.

Recommended Endpoints (example)
--------------------------------

- `GET /` — serve index.html (frontend entry)
- `GET /static/*` — serve JS/CSS/assets
- `POST /api/auth/login` — authenticate user, return cookie or JWT
- `POST /api/auth/logout` — clear session
- `POST /api/provider/switch` — protected admin endpoint; updates provider settings (proxy to FastAPI or call management endpoint)
- `POST /api/ai/ask` — proxy to `http://localhost:8000/ask` (preserve headers and auth)
- `POST /api/upload` — proxy to `http://localhost:8000/upload`
- `GET /actuator/health` — Spring Boot health (optionally aggregates RAG service health)

Security and CORS
-----------------

- Configure CORS to allow your frontend origin (or use same-site cookies with same host).
- Use HTTPS in production and set `server.ssl.*` or place behind a TLS-terminating reverse proxy.
- Use Spring Security to protect admin routes and enforce roles for provider switching.
- If using JWTs, validate them in the proxy-forwarded requests or propagate user identity headers to the RAG service.

Configuration (application.properties / application.yml)
-----------------------------------------------------

Example `application.properties` entries:

```
server.port=8080
app.rag.service.url=http://localhost:8000
app.allowed.origins=http://localhost:3000,http://localhost:8080
spring.datasource.url=jdbc:postgresql://db:5432/appdb
spring.datasource.username=app
spring.datasource.password=secret
jwt.secret=${JWT_SECRET}
```

Build & Run
-----------

Maven example:

```bash
mvn clean package
java -jar target/my-site-backend.jar
```

Gradle example:

```bash
./gradlew bootJar
java -jar build/libs/my-site-backend.jar
```

Dockerfile (simple)
-------------------

```
FROM eclipse-temurin:17-jdk-jammy
ARG JAR_FILE=target/my-site-backend.jar
COPY ${JAR_FILE} app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
```

Deployment notes
----------------

- In Kubernetes, expose the Spring Boot app via a Service/Ingress and ensure the RAG FastAPI service is reachable from the same cluster (or configure CORS and networking appropriately).
- For NAT/proxy setups, route `/api/ai/*` to the RAG service and leave site-serving to Spring Boot.
- Prefer a reverse proxy (Nginx) in front to handle TLS and static caching.

Health & Monitoring
-------------------

- Enable Spring Boot Actuator and add a composite health indicator that checks `app.rag.service.url/health`.
- Log proxied request IDs and timings for tracing across the frontend → Spring Boot → FastAPI chain.

Notes on integration with this repo
----------------------------------

- The Spring Boot backend is optional: the frontend can be served as static files directly (e.g., GitHub Pages or an object storage CDN) and call the FastAPI service directly.
- If you add a Spring Boot service, update the `README.md` and deployment manifests to include the service and its expected `app.rag.service.url`.

Further help
------------

If you'd like, I can scaffold a minimal Spring Boot project with these endpoints and a sample `application.properties`. Tell me whether you prefer Maven or Gradle and any auth method (session cookies vs JWTs).
