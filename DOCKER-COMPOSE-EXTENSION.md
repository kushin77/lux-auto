# Docker Compose Configuration for Appsmith & Backstage

This file extends the existing docker-compose.yml with Appsmith and Backstage services.

## Integration Instructions

Add these service definitions to your existing docker-compose.yml file:

```yaml
---
version: '3.8'

services:
  # Existing services: postgres, redis, fastapi, oauth2-proxy, caddy
  # ... (keep existing services) ...

  # ===== Appsmith Portal =====
  appsmith:
    image: appsmith/appsmith:latest
    container_name: lux-appsmith
    restart: unless-stopped
    
    ports:
      - "8080:80"
      - "8443:443"
    
    environment:
      # Database
      APPSMITH_DB_NAME: appsmith_db
      APPSMITH_DB_USER: appsmith_admin
      APPSMITH_DB_PASSWORD: ${APPSMITH_DB_PASSWORD}
      APPSMITH_PG_DBHOST: postgres
      APPSMITH_PG_PORT: 5432
      
      # OAuth2 Configuration
      APPSMITH_OAUTH_ENABLED: "true"
      APPSMITH_OAUTH_GOOGLE_CLIENT_ID: ${APPSMITH_OAUTH_CLIENT_ID}
      APPSMITH_OAUTH_GOOGLE_CLIENT_SECRET: ${APPSMITH_OAUTH_CLIENT_SECRET}
      
      # Domain & SSL
      APPSMITH_COMMENT_MODE_PUBLISH_ENABLED: "true"
      APPSMITH_DISABLE_TELEMETRY: "true"
      
      # Redis for caching
      APPSMITH_REDIS_HOST: redis
      APPSMITH_REDIS_PORT: 6379
    
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    
    volumes:
      - appsmith_data:/appsmith-stacks
    
    networks:
      - lux-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/api/v1/users/me"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    
    labels:
      - "com.example.description=Appsmith Low-Code Portal"

  # ===== Backstage Developer Portal =====
  backstage:
    image: backstage/backstage:latest
    container_name: lux-backstage
    restart: unless-stopped
    
    ports:
      - "3000:3000"
    
    environment:
      # Database
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: backstage_admin
      POSTGRES_PASSWORD: ${BACKSTAGE_DB_PASSWORD}
      POSTGRES_DB: backstage_db
      
      # Backend Configuration
      BACKSTAGE_AUTH_ENABLED: "true"
      BACKSTAGE_BACKEND_BASEURL: https://backstage.lux.kushnir.cloud
      BACKSTAGE_FRONTEND_BASEURL: https://backstage.lux.kushnir.cloud
      
      # GitHub Integration
      BACKSTAGE_AUTH_GITHUB_CLIENT_ID: ${BACKSTAGE_GITHUB_CLIENT_ID}
      BACKSTAGE_AUTH_GITHUB_CLIENT_SECRET: ${BACKSTAGE_GITHUB_CLIENT_SECRET}
      BACKSTAGE_GITHUB_TOKEN: ${BACKSTAGE_GITHUB_TOKEN}
      
      # Redis
      REDIS_HOST: redis
      REDIS_PORT: 6379
      
      # Node environment
      NODE_ENV: production
      NODE_OPTIONS: "--max_old_space_size=2048"
    
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    
    volumes:
      - backstage_config:/app/packages/backend/config
      - backstage_data:/app/packages/backend/data
    
    networks:
      - lux-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "https://lux.kushnir.cloud/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 60s
    
    labels:
      - "com.example.description=Backstage Developer Portal"

  # ===== Existing Services Configuration (Keep as-is) =====
  postgres:
    image: postgres:15-alpine
    container_name: lux-postgres
    restart: unless-stopped
    
    environment:
      POSTGRES_USER: ${DB_USER:-lux_admin}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: lux_prod
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    
    ports:
      - "5432:5432"
    
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./scripts/portal-schema.sql:/docker-entrypoint-initdb.d/02-portal.sql
    
    networks:
      - lux-network
    
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-lux_admin}"]
      interval: 10s
      timeout: 5s
      retries: 5
    
    command:
      - "postgres"
      - "-max_connections=200"
      - "-shared_buffers=256MB"
      - "-effective_cache_size=1GB"

  redis:
    image: redis:7-alpine
    container_name: lux-redis
    restart: unless-stopped
    
    ports:
      - "6379:6379"
    
    volumes:
      - redis_data:/data
    
    networks:
      - lux-network
    
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    
    command:
      - redis-server
      - "--appendonly"
      - "yes"
      - "--appendonly"
      - "fsync"
      - "everysec"

  fastapi:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: lux-fastapi
    restart: unless-stopped
    
    environment:
      FASTAPI_SECRET_KEY: ${FASTAPI_SECRET_KEY}
      DATABASE_URL: postgresql://${DB_USER:-lux_admin}:${DATABASE_PASSWORD}@postgres:5432/lux_prod
      REDIS_URL: redis://redis:6379
      OAUTH2_PROXY_URL: http://oauth2-proxy:4180
    
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    
    ports:
      - "8000:8000"
    
    volumes:
      - ./backend:/app/backend
    
    networks:
      - lux-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "https://lux.kushnir.cloud/api/v1/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:latest
    container_name: lux-oauth2-proxy
    restart: unless-stopped
    
    environment:
      OAUTH2_PROXY_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      OAUTH2_PROXY_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      OAUTH2_PROXY_COOKIE_SECRET: ${OAUTH2_PROXY_COOKIE_SECRET}
      OAUTH2_PROXY_COOKIE_SECURE: "true"
      OAUTH2_PROXY_COOKIE_HTTPONLY: "true"
      OAUTH2_PROXY_COOKIE_SAMESITE: "Lax"
      OAUTH2_PROXY_PROVIDER: google
      OAUTH2_PROXY_EMAIL_DOMAINS: "*"
      OAUTH2_PROXY_UPSTREAMS:
        - http://fastapi:8000
        - http://appsmith:80
        - http://backstage:3000
      OAUTH2_PROXY_SHOW_DEBUG_ON_ERROR: "true"
      OAUTH2_PROXY_COOKIE_EXPIRE: "24h"
    
    ports:
      - "4180:4180"
    
    networks:
      - lux-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "https://lux.kushnir.cloud/oauth2/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    container_name: lux-caddy
    restart: unless-stopped
    
    ports:
      - "80:80"
      - "443:443"
    
    volumes:
      - ./Caddyfile.tpl:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    
    environment:
      DOMAIN: ${DOMAIN:-lux.kushnir.cloud}
      ACME_EMAIL: ${ACME_EMAIL:-akushnir@bioenergystrategies.com}
    
    networks:
      - lux-network
    
    depends_on:
      - oauth2-proxy
      - fastapi
      - appsmith
      - backstage
    
    healthcheck:
      test: ["CMD", "curl", "-f", "-k", "https://lux.kushnir.cloud/health"]
      interval: 10s
      timeout: 5s
      retries: 5

# ===== Volumes =====
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  caddy_data:
    driver: local
  caddy_config:
    driver: local
  appsmith_data:
    driver: local
  backstage_config:
    driver: local
  backstage_data:
    driver: local

# ===== Networks =====
networks:
  lux-network:
    driver: bridge
```

## Environment Variables Required

Add these to your `.env` file:

```bash
# Appsmith Configuration
APPSMITH_DB_PASSWORD=<generate-strong-password>
APPSMITH_OAUTH_CLIENT_ID=<from-google-cloud-console>
APPSMITH_OAUTH_CLIENT_SECRET=<from-google-cloud-console>

# Backstage Configuration
BACKSTAGE_DB_PASSWORD=<generate-strong-password>
BACKSTAGE_GITHUB_CLIENT_ID=<from-github-app>
BACKSTAGE_GITHUB_CLIENT_SECRET=<from-github-app>
BACKSTAGE_GITHUB_TOKEN=<personal-access-token>

# Existing variables (update if needed)
GOOGLE_CLIENT_ID=<existing>
GOOGLE_CLIENT_SECRET=<existing>
OAUTH2_PROXY_COOKIE_SECRET=<existing>
FASTAPI_SECRET_KEY=<existing>
DATABASE_PASSWORD=<existing>
DOMAIN=lux.kushnir.cloud
ACME_EMAIL=akushnir@bioenergystrategies.com
```

## Caddyfile Extensions

Update your Caddyfile.tpl to include:

```caddy
# Appsmith Portal
appsmith.{$DOMAIN} {
  reverse_proxy http://oauth2-proxy:4180
  
  # Security headers
  header X-Frame-Options "SAMEORIGIN"
  header X-Content-Type-Options "nosniff"
  header Referrer-Policy "strict-origin-when-cross-origin"
  
  # TLS
  tls {$ACME_EMAIL}
}

# Backstage Portal
backstage.{$DOMAIN} {
  reverse_proxy http://oauth2-proxy:4180
  
  # Security headers
  header X-Frame-Options "SAMEORIGIN"
  header X-Content-Type-Options "nosniff"
  
  # TLS
  tls {$ACME_EMAIL}
}
```

## Database Initialization

The `scripts/portal-schema.sql` file will be automatically executed during postgres initialization.
Make sure to create this file with the portal schema (audit logs, user preferences, API keys, roles tables).

## Deployment Instructions

1. **Update environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with Appsmith and Backstage credentials
   ```

2. **Validate configuration:**
   ```bash
   bash scripts/validate-config.sh
   ```

3. **Deploy services:**
   ```bash
   docker-compose up -d postgres redis fastapi appsmith backstage oauth2-proxy caddy
   ```

4. **Verify health:**
   ```bash
   docker-compose ps
   # All services should show "healthy" status
   ```

5. **Access portals:**
   - FastAPI: https://lux.kushnir.cloud/api/v1/docs
   - Appsmith: https://appsmith.lux.kushnir.cloud
   - Backstage: https://backstage.lux.kushnir.cloud

