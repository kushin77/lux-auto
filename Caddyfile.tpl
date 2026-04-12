{$DOMAIN} {
    # HTTPS configuration
    tls {$ACME_EMAIL}
    
    # Security headers
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    header X-Content-Type-Options "nosniff"
    header X-Frame-Options "DENY"
    header X-XSS-Protection "1; mode=block"
    header Referrer-Policy "strict-origin-when-cross-origin"
    header Permissions-Policy "geolocation=(), microphone=(), camera=()"
    
    # CSP header - restrictive by default
    header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    
    # Redirect HTTP to HTTPS
    @http {
        protocol http
    }
    redir @http https://{host}{uri} permanent
    
    # Health check endpoint (no auth required)
    @health {
        path /health
    }
    handle @health {
        reverse_proxy fastapi:8000 {
            header_uri X-Forwarded-For {http.request.remote.host}
            header_uri X-Forwarded-Proto {http.request.proto}
            header_uri X-Forwarded-Host {http.request.host}
        }
    }
    
    # OAuth2 proxy paths (auth middleware)
    @oauth {
        path /oauth2/*
    }
    handle @oauth {
        reverse_proxy oauth2-proxy:4180
    }
    
    # API paths (require authentication)
    @api {
        path /api/*
    }
    handle @api {
        # Check authentication via oauth2-proxy
        forward_auth oauth2-proxy:4180 {
            uri /oauth2/auth
            copy_headers X-Auth-Request-Email X-Auth-Request-User
            copy_headers X-Auth-Request-Groups
            copy_headers Cookie
        }
        
        # Reverse proxy to FastAPI
        reverse_proxy fastapi:8000 {
            header_uri X-Forwarded-For {http.request.remote.host}
            header_uri X-Forwarded-Proto {http.request.proto}
            header_uri X-Forwarded-Host {http.request.host}
        }
    }
    
    # Metrics endpoint (protected)
    @metrics {
        path /metrics
    }
    handle @metrics {
        forward_auth oauth2-proxy:4180 {
            uri /oauth2/auth
            copy_headers X-Auth-Request-Email X-Auth-Request-User
        }
        reverse_proxy fastapi:8000
    }
    
    # Default root path (redirects to login)
    @root {
        path /
    }
    handle @root {
        redir /oauth2/sign_in 302
    }
    
    # Fallback - redirect to OAuth login
    handle {
        redir /oauth2/sign_in 302
    }
    
    # Error handling
    handle_errors {
        header Content-Type text/plain
        respond "{err.status_code} {err.status_text}"
    }
    
    # Logging
    log {
        output stdout
        level debug
        format json
    }
}

# Appsmith Portal Subdomain
appsmith.{$DOMAIN} {
    tls {$ACME_EMAIL}
    
    # Security headers for Appsmith
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    header X-Content-Type-Options "nosniff"
    header X-XSS-Protection "1; mode=block"
    header Referrer-Policy "no-referrer-when-downgrade"
    
    # More permissive CSP for Appsmith
    header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self'"
    
    # Redirect HTTP to HTTPS
    @http {
        protocol http
    }
    redir @http https://{host}{uri} permanent
    
    # Forward auth to oauth2-proxy
    @protected {
        path !/health
        path !/icon
    }
    handle @protected {
        forward_auth oauth2-proxy:4180 {
            uri /oauth2/auth
            copy_headers X-Auth-Request-Email X-Auth-Request-User
            copy_headers Cookie
        }
        reverse_proxy appsmith:80 {
            header_uri X-Forwarded-For {http.request.remote.host}
            header_uri X-Forwarded-Proto https
            header_uri X-Forwarded-Host {http.request.host}
        }
    }
    
    # Health check (no auth required)
    @health {
        path /health
    }
    handle @health {
        reverse_proxy appsmith:80
    }
    
    # Fallback
    handle {
        reverse_proxy appsmith:80 {
            header_uri X-Forwarded-For {http.request.remote.host}
            header_uri X-Forwarded-Proto https
            header_uri X-Forwarded-Host {http.request.host}
        }
    }
    
    log {
        output stdout
        format json
    }
}

# Backstage Portal Subdomain
backstage.{$DOMAIN} {
    tls {$ACME_EMAIL}
    
    # Security headers for Backstage
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    header X-Content-Type-Options "nosniff"
    header X-XSS-Protection "1; mode=block"
    header Referrer-Policy "no-referrer-when-downgrade"
    
    # CSP for Backstage
    header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https:; object-src 'none'"
    
    # Redirect HTTP to HTTPS
    @http {
        protocol http
    }
    redir @http https://{host}{uri} permanent
    
    # Forward auth to oauth2-proxy
    @protected {
        path !/health
        path !/api/health
    }
    handle @protected {
        forward_auth oauth2-proxy:4180 {
            uri /oauth2/auth
            copy_headers X-Auth-Request-Email X-Auth-Request-User
            copy_headers Cookie
        }
        reverse_proxy backstage:3000 {
            header_uri X-Forwarded-For {http.request.remote.host}
            header_uri X-Forwarded-Proto https
            header_uri X-Forwarded-Host {http.request.host}
        }
    }
    
    # Health check (no auth required)
    @health {
        path /health
        path /api/health
    }
    handle @health {
        reverse_proxy backstage:3000
    }
    
    # Fallback
    handle {
        reverse_proxy backstage:3000 {
            header_uri X-Forwarded-For {http.request.remote.host}
            header_uri X-Forwarded-Proto https
            header_uri X-Forwarded-Host {http.request.host}
        }
    }
    
    log {
        output stdout
        format json
    }
}

# Admin API for Caddy management
:2019 {
    admin
}
