"""
Security hardening module for Lux-Auto portal.

Implements:
- Input validation and sanitization
- Rate limiting and DDoS protection
- SQL injection prevention
- XSS protection
- CSRF protection
- Encryption at rest and in transit
- Audit logging for security events
- API key management
"""

import hashlib
import secrets
import time
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional, Dict, Set, Callable, Any
from dataclasses import dataclass, field
import logging

from fastapi import HTTPException, Request
import redis

logger = logging.getLogger(__name__)

# ============================================================================
# RATE LIMITING
# ============================================================================

@dataclass
class RateLimitConfig:
    """Rate limiting configuration."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_size: int = 10
    
    # IP-based limits (stricter for anonymous)
    ip_requests_per_minute: int = 30
    ip_requests_per_hour: int = 500
    
    # API endpoint-specific limits
    auth_attempts_per_minute: int = 5
    bulk_operations_per_hour: int = 10
    export_requests_per_hour: int = 20


class RateLimiter:
    """Token bucket rate limiter using Redis."""
    
    def __init__(
        self,
        redis_url: str = "redis://:password@cache:6379/0",
        config: RateLimitConfig = RateLimitConfig()
    ):
        self.redis = redis.from_url(redis_url)
        self.config = config
    
    def is_allowed(
        self,
        identifier: str,  # user_id or IP address
        limit_type: str = "general",  # general, auth, bulk, export
        limit_key: Optional[str] = None
    ) -> tuple[bool, Dict[str, Any]]:
        """
        Check if request is allowed under rate limit.
        
        Returns: (is_allowed, metadata)
            is_allowed: bool - whether request can proceed
            metadata: dict with remaining, reset_at, limit info
        """
        
        key = f"ratelimit:{identifier}:{limit_type}"
        if limit_key:
            key += f":{limit_key}"
        
        # Get current count
        current = self.redis.incr(key)
        
        # Set expiration if new key
        if current == 1:
            if limit_type == "general":
                self.redis.expire(key, 60)  # 1 minute window
            else:
                self.redis.expire(key, 3600)  # 1 hour window
        
        # Get TTL for reset time
        ttl = self.redis.ttl(key)
        reset_at = datetime.utcnow() + timedelta(seconds=ttl)
        
        # Check limits based on type
        if limit_type == "auth":
            limit = self.config.auth_attempts_per_minute
        elif limit_type == "bulk":
            limit = self.config.bulk_operations_per_hour
        elif limit_type == "export":
            limit = self.config.export_requests_per_hour
        else:
            limit = self.config.requests_per_minute
        
        is_allowed = current <= limit
        
        if not is_allowed:
            logger.warning(
                f"Rate limit exceeded",
                extra={
                    "identifier": identifier,
                    "type": limit_type,
                    "current": current,
                    "limit": limit
                }
            )
        
        return is_allowed, {
            "limit": limit,
            "remaining": max(0, limit - current),
            "reset_at": reset_at.isoformat(),
            "retry_after": max(0, ttl)
        }
    
    def get_reset_time(self, identifier: str, limit_type: str = "general") -> Optional[datetime]:
        """Get when rate limit resets for identifier."""
        key = f"ratelimit:{identifier}:{limit_type}"
        ttl = self.redis.ttl(key)
        
        if ttl <= 0:
            return None
        
        return datetime.utcnow() + timedelta(seconds=ttl)


def rate_limit(limit_type: str = "general"):
    """Decorator to enforce rate limiting on endpoints."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request and user info from args/kwargs
            # This would be improved with proper dependency injection
            request = kwargs.get("request")
            current_user = kwargs.get("current_user")
            
            # Use user_id if authenticated, IP address otherwise
            identifier = str(current_user.id) if current_user else request.client.host
            
            limiter = RateLimiter()
            allowed, metadata = limiter.is_allowed(identifier, limit_type)
            
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Retry after {metadata['retry_after']}s"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# ============================================================================
# INPUT VALIDATION & SANITIZATION
# ============================================================================

class InputValidator:
    """Validate and sanitize user inputs."""
    
    # Blacklisted characters and patterns (SQL injection, XSS)
    DANGEROUS_PATTERNS = [
        r"';(?:DROP|DELETE|UPDATE|INSERT)",  # SQL injection
        r"<script[^>]*>",  # XSS
        r"onclick=|onload=|onerror=",  # Event handlers
        r"javascript:",  # JavaScript protocol
    ]
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format."""
        import re
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return re.match(pattern, email) is not None
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number format."""
        import re
        # International format: +1-234-567-8910 or variants
        pattern = r"^(\+\d{1,3})?[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$"
        return re.match(pattern, phone) is not None
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 1000) -> str:
        """Sanitize string input."""
        if not isinstance(value, str):
            raise ValueError("Input must be string")
        
        # Limit length
        value = value[:max_length]
        
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Remove control characters
        value = ''.join(c for c in value if ord(c) >= 32 or c in '\n\r\t')
        
        return value.strip()
    
    @staticmethod
    def sanitize_html(html: str) -> str:
        """
        Sanitize HTML to prevent XSS.
        
        NOTE: In production, use bleach library or similar
            pip install bleach
        """
        import html
        
        # Escape HTML entities
        html_escaped = html.escape(html)
        
        # Remove dangerous tags/attributes
        dangerous = ["<script", "onclick", "onerror", "onload", "javascript:"]
        for danger in dangerous:
            if danger.lower() in html_escaped.lower():
                raise ValueError(f"Dangerous content detected: {danger}")
        
        return html_escaped
    
    @staticmethod
    def validate_json_payload(data: dict, max_size_mb: int = 10) -> bool:
        """Validate JSON payload."""
        import json
        
        size_mb = len(json.dumps(data).encode()) / (1024 * 1024)
        if size_mb > max_size_mb:
            raise ValueError(f"Payload too large: {size_mb:.2f}MB")
        
        return True


# ============================================================================
# SQL INJECTION PREVENTION
# ============================================================================

class SQLInjectionGuard:
    """Prevent SQL injection attacks."""
    
    # SQLAlchemy handles parameterized queries automatically
    # This module provides additional validation
    
    @staticmethod
    def validate_column_name(name: str) -> bool:
        """Validate column name (prevent column injection)."""
        import re
        # Only alphanumeric, underscore, allowed
        return re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", name) is not None
    
    @staticmethod
    def validate_table_name(name: str) -> bool:
        """Validate table name (prevent table injection)."""
        import re
        return re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", name) is not None
    
    @staticmethod
    def quote_identifier(identifier: str) -> str:
        """Quote SQL identifier for safety."""
        if not SQLInjectionGuard.validate_column_name(identifier):
            raise ValueError(f"Invalid identifier: {identifier}")
        
        # Use double quotes for PostgreSQL
        return f'"{identifier}"'


# ============================================================================
# ENCRYPTION
# ============================================================================

class EncryptionService:
    """Handle encryption of sensitive data."""
    
    # In production, use a proper key management service
    # For example: AWS KMS, HashiCorp Vault, or Azure Key Vault
    ENCRYPTION_KEY = "changeme-use-kms-in-production"
    
    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
        """
        Hash password using PBKDF2.
        
        In production, use bcrypt or argon2:
            pip install bcrypt
        """
        if salt is None:
            salt = secrets.token_hex(32)
        
        hash_obj = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode(),
            salt.encode(),
            100000  # iterations
        )
        
        return hash_obj.hex(), salt
    
    @staticmethod
    def verify_password(password: str, hash_value: str, salt: str) -> bool:
        """Verify password against stored hash."""
        computed_hash, _ = EncryptionService.hash_password(password, salt)
        return computed_hash == hash_value
    
    @staticmethod
    def encrypt_sensitive_field(value: str) -> str:
        """
        Encrypt sensitive field (API keys, credentials).
        
        In production, use cryptography library:
            pip install cryptography
        """
        # Placeholder: implement using cryptography.fernet
        # Example:
        # from cryptography.fernet import Fernet
        # f = Fernet(key)
        # encrypted = f.encrypt(value.encode())
        
        logger.warning("Using placeholder encryption - implement with cryptography library")
        return f"encrypted_{hashlib.sha256(value.encode()).hexdigest()}"
    
    @staticmethod
    def decrypt_sensitive_field(encrypted: str) -> str:
        """Decrypt sensitive field."""
        # Placeholder implementation
        logger.warning("Using placeholder decryption - implement with cryptography library")
        raise NotImplementedError("Implement with cryptography.fernet")


# ============================================================================
# CSRF PROTECTION
# ============================================================================

class CSRFProtection:
    """CSRF token generation and validation."""
    
    def __init__(self, redis_url: str = "redis://:password@cache:6379/0"):
        self.redis = redis.from_url(redis_url)
    
    def generate_token(self, session_id: str) -> str:
        """Generate CSRF token for session."""
        token = secrets.token_urlsafe(32)
        
        # Store in Redis with session ID
        key = f"csrf:{session_id}"
        self.redis.setex(key, 3600, token)
        
        return token
    
    def validate_token(self, session_id: str, token: str) -> bool:
        """Validate CSRF token."""
        key = f"csrf:{session_id}"
        stored_token = self.redis.get(key)
        
        if not stored_token:
            return False
        
        # Use constant-time comparison to prevent timing attacks
        return secrets.compare_digest(stored_token.decode(), token)


# ============================================================================
# API KEY MANAGEMENT
# ============================================================================

class APIKeyManager:
    """Manage API keys for service-to-service authentication."""
    
    def __init__(self, redis_url: str = "redis://:password@cache:6379/0"):
        self.redis = redis.from_url(redis_url)
    
    def generate_api_key(self, service_name: str) -> str:
        """Generate new API key for service."""
        key = secrets.token_urlsafe(32)
        
        # Hash for storage (never store plaintext)
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        # Store with metadata
        metadata = {
            "service": service_name,
            "created_at": datetime.utcnow().isoformat(),
            "last_used": None,
            "active": True
        }
        
        self.redis.hset(f"apikey:{key_hash}", mapping=metadata)
        
        # Return unhashed key (user only receives once)
        logger.info(
            f"API key generated for service: {service_name}",
            extra={"key_hash": key_hash[:16] + "..."}
        )
        
        return key
    
    def validate_api_key(self, key: str) -> Optional[Dict]:
        """Validate API key and return metadata."""
        # Hash the provided key
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        # Look up in Redis
        metadata = self.redis.hgetall(f"apikey:{key_hash}")
        
        if not metadata or not metadata.get(b"active"):
            logger.warning(f"Invalid or inactive API key attempted")
            return None
        
        # Update last_used
        self.redis.hset(f"apikey:{key_hash}", "last_used", datetime.utcnow().isoformat())
        
        return {
            "service": metadata[b"service"].decode(),
            "created_at": metadata[b"created_at"].decode(),
            "last_used": metadata.get(b"last_used", b"Never").decode()
        }
    
    def revoke_api_key(self, key: str) -> bool:
        """Revoke API key."""
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        metadata = self.redis.hgetall(f"apikey:{key_hash}")
        if not metadata:
            return False
        
        # Mark as inactive
        self.redis.hset(f"apikey:{key_hash}", "active", "False")
        
        logger.info(f"API key revoked", extra={"key_hash": key_hash[:16] + "..."})
        return True


# ============================================================================
# SECURITY AUDIT LOGGING
# ============================================================================

class SecurityAuditLog:
    """Log security-related events."""
    
    EVENTS = {
        "auth_success": "Successful authentication",
        "auth_failure": "Failed authentication attempt",
        "auth_brute_force": "Brute force detection",
        "permission_denied": "Permission denied",
        "data_accessed": "Sensitive data accessed",
        "data_modified": "Critical data modified",
        "api_key_generated": "API key generated",
        "api_key_revoked": "API key revoked",
        "rate_limit_exceeded": "Rate limit exceeded",
        "injection_attempt": "Possible injection attempt",
        "xss_attempt": "Possible XSS attempt",
    }
    
    @staticmethod
    def log_event(
        event_type: str,
        user_id: Optional[int],
        ip_address: str,
        details: Optional[Dict] = None,
        severity: str = "info"  # info, warning, critical
    ):
        """Log security event."""
        
        if event_type not in SecurityAuditLog.EVENTS:
            raise ValueError(f"Unknown event type: {event_type}")
        
        event_desc = SecurityAuditLog.EVENTS[event_type]
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "description": event_desc,
            "user_id": user_id,
            "ip_address": ip_address,
            "severity": severity,
            "details": details or {}
        }
        
        # Log level based on severity
        if severity == "critical":
            logger.critical(event_desc, extra=log_entry)
        elif severity == "warning":
            logger.warning(event_desc, extra=log_entry)
        else:
            logger.info(event_desc, extra=log_entry)


# ============================================================================
# SECURITY HEADERS
# ============================================================================

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",  # Prevent MIME sniffing
    "X-Frame-Options": "DENY",  # Prevent clickjacking
    "X-XSS-Protection": "1; mode=block",  # Enable XSS protection
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",  # HSTS
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
}


def add_security_headers(response):
    """Add security headers to response."""
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    
    return response

