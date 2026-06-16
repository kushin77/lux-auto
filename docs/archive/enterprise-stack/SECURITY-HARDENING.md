# Portal Security Hardening Guide

## Security Overview

Comprehensive security practices for the Lux-Auto platform covering authentication, authorization, data protection, and infrastructure security.

---

## Core Security Principles

```
┌─────────────────────────────────────────────┐
│  Defense in Depth Strategy                  │
├─────────────────────────────────────────────┤
│  Layer 1: Network Security                  │
│  - HTTPS/TLS encryption                    │
│  - Firewall rules                          │
│  - DDoS protection                         │
├─────────────────────────────────────────────┤
│  Layer 2: API Security                      │
│  - Input validation                        │
│  - Rate limiting                           │
│  - CORS configuration                      │
├─────────────────────────────────────────────┤
│  Layer 3: Application Security              │
│  - CSRF protection                         │
│  - XSS prevention                          │
│  - SQL injection prevention                │
├─────────────────────────────────────────────┤
│  Layer 4: Data Security                     │
│  - Encryption at rest                      │
│  - Encryption in transit                   │
│  - Secure key management                   │
├─────────────────────────────────────────────┤
│  Layer 5: Access Control                    │
│  - RBAC enforcement                        │
│  - Session management                      │
│  - Audit logging                           │
└─────────────────────────────────────────────┘
```

---

## Input Validation & Sanitization

### Server-Side Input Validation

```python
# backend/validation.py
from pydantic import BaseModel, Field, validator, EmailStr

class CreateDealRequest(BaseModel):
    vin: str = Field(..., min_length=17, max_length=17, regex="^[A-HJ-NPR-Z0-9]{17}$")  # VIN format
    year: int = Field(..., ge=1900, le=2024)  # Valid year range
    make: str = Field(..., min_length=1, max_length=50, regex="^[a-zA-Z0-9\\s-]+$")
    model: str = Field(..., min_length=1, max_length=50)
    listing_price: float = Field(..., gt=0, le=500000)  # Max price
    mmr_value: float = Field(..., gt=0, le=500000)
    
    @validator('make', 'model')
    def sanitize_strings(cls, v):
        # Remove special characters
        return v.replace('<', '').replace('>', '').replace('"', '').strip()

class CreateBuyerRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr  # Validates email format
    phone: str = Field(..., regex=r"^\+?[\d\-() ]{10,}$")
    company: str = Field(..., max_length=100)
    
    @validator('phone')
    def validate_phone(cls, v):
        # Extract only digits
        digits = ''.join(filter(str.isdigit, v))
        if len(digits) < 10:
            raise ValueError('Invalid phone number')
        return v
```

### Frontend Input Validation

In Appsmith, validate before sending:

```javascript
// Validate in widget event handlers
const validateDealForm = () => {
  const errors = {};
  
  if (!vinInput.value || vinInput.value.length !== 17) {
    errors.vin = 'VIN must be 17 characters';
  }
  
  if (!yearInput.value || yearInput.value < 1900 || yearInput.value > 2024) {
    errors.year = 'Invalid year';
  }
  
  if (listingPriceInput.value <= 0) {
    errors.listing_price = 'Price must be positive';
  }
  
  return Object.keys(errors).length === 0;
};
```

### Parameterized Queries

Always use parameterized queries to prevent SQL injection:

```python
# ✅ GOOD: Parameterized query
deals = session.query(Deals).filter(
    Deals.status == status_param,  # Bound parameter, not string concatenation
    Deals.make == make_param
).all()

# ❌ BAD: String concatenation (SQL injection vulnerable)
query = f"SELECT * FROM deals WHERE status = '{status}' AND make = '{make}'"
# User could enter: ' OR '1'='1
```

---

## Authentication & Session Management

### OAuth2 Configuration

```python
# backend/auth/oauth.py
from fastapi_oauth2_client import OAuth2Login

oauth = OAuth2Login(
    google_client_id=os.getenv("GOOGLE_CLIENT_ID"),
    google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    redirect_url="https://lux.kushnir.cloud/auth/callback"
)

@router.post("/auth/login")
async def login(code: str):
    # Exchange code for token
    token = await oauth.get_token(code)
    user_info = await oauth.get_user_info(token["access_token"])
    
    # Create session
    session = create_session(user_info["email"], token)
    return {"sessionToken": session.token}
```

### Session Security

```yaml
# Session configuration
session:
  httpOnly: true          # JS cannot access cookie
  secure: true            # HTTPS only
  sameSite: "Strict"      # CSRF protection
  maxAge: 86400           # 24 hours
  domain: lux.kushnir.cloud
  path: /
```

### Password-less Auth with OAuth

Lux-Auto uses Google OAuth instead of passwords:

✅ **Benefits**:
- No password storage/management
- MFA built-in
- Standard security updates
- Better user experience

---

## CSRF Protection

### CSRF Token Implementation

```python
# backend/middleware/csrf.py
from fastapi import HTTPException

class CSRFMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request, call_next):
        # Skip CSRF check for safe methods
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return await call_next(request)
        
        # Verify CSRF token for state-changing requests
        csrf_token = request.headers.get("X-CSRF-Token")
        session_token = request.cookies.get("session")
        
        if not verify_csrf_token(csrf_token, session_token):
            raise HTTPException(status_code=403, detail="CSRF validation failed")
        
        return await call_next(request)
```

### CSRF Token in Appsmith

```javascript
// Automatically included in API requests
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

// Include in custom requests
fetch('/api/v2/deals', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

---

## Cross-Origin Resource Sharing (CORS)

### Strict CORS Configuration

```python
# backend/config.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://appsmith.lux.kushnir.cloud",
        "https://backstage.lux.kushnir.cloud",
        "https://lux.kushnir.cloud"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    expose_headers=["X-Total-Count", "X-Page"],
    max_age=3600
)
```

### CORS Headers Explained

| Header | Purpose |
|--------|---------|
| `Access-Control-Allow-Origin` | Allowed origins |
| `Access-Control-Allow-Credentials` | Include cookies in requests |
| `Access-Control-Allow-Methods` | Allowed HTTP methods |
| `Access-Control-Allow-Headers` | Allowed request headers |
| `Access-Control-Max-Age` | Cache duration |

---

## Rate Limiting

### API Rate Limiting

```python
# backend/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v2/deals")
@limiter.limit("100/minute")  # 100 requests per minute
async def list_deals():
    pass

# Role-based rate limits
RATE_LIMITS = {
    "VIEWER": "1000/hour",
    "ANALYST": "5000/hour",
    "ADMIN": "10000/hour",
    "SUPER_ADMIN": None  # Unlimited
}

@app.get("/api/v2/deals")
async def list_deals(request: Request):
    user_role = request.state.user.role
    limit = RATE_LIMITS.get(user_role, "1000/hour")
    
    @limiter.limit(limit)
    async def _get_deals():
        pass
    
    return await _get_deals()
```

### Rate Limit Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1712973600
```

---

## Encryption

### Encryption at Rest

```python
# backend/encryption.py
from cryptography.fernet import Fernet

class DataEncryption:
    def __init__(self):
        self.cipher = Fernet(os.getenv("ENCRYPTION_KEY"))
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt data"""
        return self.cipher.decrypt(ciphertext.encode()).decode()

encryption = DataEncryption()

# Encrypt sensitive fields
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID, primary_key=True)
    email = Column(String, index=True)
    ssn_encrypted = Column(String)  # Encrypted SSN
    
    def set_ssn(self, ssn: str):
        self.ssn_encrypted = encryption.encrypt(ssn)
    
    def get_ssn(self) -> str:
        return encryption.decrypt(self.ssn_encrypted)
```

### Encryption in Transit

All communication uses HTTPS/TLS 1.3:

```yaml
# Caddy configuration (automatic HTTPS)
{
  https://lux.kushnir.cloud {
    encode gzip
    
    # Force HTTPS
    header /-/ {
      Strict-Transport-Security "max-age=31536000; includeSubDomains"
      X-Content-Type-Options "nosniff"
      X-Frame-Options "DENY"
      X-XSS-Protection "1; mode=block"
    }
  }
}
```

---

## Secret Management

### Environment Variable Security

```bash
# .env.example (NO SECRETS!)
DATABASE_PASSWORD=CHANGE_ME
REDIS_PASSWORD=CHANGE_ME
FASTAPI_SECRET_KEY=CHANGE_ME
GOOGLE_CLIENT_ID=CHANGE_ME

# .env (use secrets manager)
# Do NOT commit to git!
```

### HashiCorp Vault Integration

For production:

```python
# backend/config/secrets.py
import hvac

class VaultSecrets:
    def __init__(self):
        self.client = hvac.Client(
            url=os.getenv("VAULT_ADDR"),
            token=os.getenv("VAULT_TOKEN")
        )
    
    def get_secret(self, path: str) -> dict:
        """Fetch secret from Vault"""
        response = self.client.secrets.kv.v2.read_secret_version(path)
        return response['data']['data']

vault = VaultSecrets()
db_password = vault.get_secret('secret/database')['password']
```

---

## Authorization & Access Control

### RBAC Enforcement

```python
# backend/dependencies.py
from fastapi import Depends, HTTPException

async def require_role(required_roles: List[str]):
    def verify_role(user: User = Depends(get_current_user)):
        if user.role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return verify_role

# Usage
@router.post("/api/v2/deals/{id}/approve")
async def approve_deal(
    id: int,
    user: User = Depends(require_role(["ADMIN", "SUPER_ADMIN"]))
):
    """Only ADMIN and SUPER_ADMIN can approve deals"""
    pass
```

### Resource-Level Authorization

```python
# backend/handlers.py
def can_view_deal(user: User, deal: Deal) -> bool:
    """Check if user can view deal"""
    if user.role == "SUPER_ADMIN":
        return True
    
    if user.role == "ADMIN":
        return True  # Admins see all
    
    if user.role == "ANALYST":
        return deal.owner_id == user.id or deal.status == "approved"
    
    if user.role == "VIEWER":
        return deal.status == "approved"  # Viewers only see approved
    
    return False

@router.get("/api/v2/deals/{id}")
async def get_deal(id: int, user: User = Depends(get_current_user)):
    deal = session.query(Deal).get(id)
    
    if not can_view_deal(user, deal):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return deal
```

---

## XSS Protection

### Content Security Policy (CSP)

```python
# backend/config.py
app.add_middleware(
    HTTPMiddleware,
    dispatch=set_headers
)

async def set_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://apis.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://*.lux.kushnir.cloud"
    )
    return response
```

### Output Encoding

In Appsmith, HTML is automatically escaped:

```javascript
// ✅ Safe - Appsmith escapes HTML
{{ userInput }}  // <script> tags are escaped

// ❌ Dangerous - Renders raw HTML
{{ dangerouslySetInnerHTML(userInput) }}
```

---

## Logging & Monitoring Security

### Secure Logging

```python
# backend/logging_config.py
import logging

class SensitiveDataFilter(logging.Filter):
    """Redact sensitive data from logs"""
    
    def filter(self, record):
        # Redact passwords
        record.msg = record.msg.replace(
            os.getenv("DATABASE_PASSWORD", ""),
            "***REDACTED***"
        )
        return True

logging.getLogger("backend").addFilter(SensitiveDataFilter())
```

### Audit Trail

```python
# backend/audit.py
async def audit_log(
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: int,
    changes: dict,
    request: Request
):
    """Log all user actions for compliance"""
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=changes,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        timestamp=datetime.utcnow()
    )
    session.add(log_entry)
    session.commit()
```

---

## Dependency Vulnerability Management

### Regular Updates

```bash
# Check for vulnerabilities
pip install safety
safety check

# Update dependencies
pip install --upgrade pip
pip install --upgrade -r requirements.txt

# Check for vulnerabilities in JavaScript
npm audit
npm audit fix
```

### Dependency Locking

```
# requirements.txt (pinned versions)
fastapi==0.104.1
sqlalchemy==2.0.23
pydantic==2.5.0
# Never use >= which allows breaking changes
```

---

## Security Headers

### Essential Security Headers

```python
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"  # Prevent clickjacking
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response
```

---

## Security Testing & Validation

### Automated Security Scanning

```bash
# SAST (Static Analysis)
pip install bandit
bandit -r backend/

# Dependency scanning
pip install pip-audit
pip audit

# DAST (Dynamic Analysis)
# Use OWASP ZAP or Burp Suite
```

### Manual Testing Checklist

- [ ] SQL Injection attempts blocked
- [ ] XSS payloads sanitized
- [ ] CSRF protection verified
- [ ] Authentication bypass attempts fail
- [ ] Authorization properly enforced
- [ ] Rate limiting blocks excessive requests
- [ ] Session fixation protected
- [ ] Sensitive data encrypted
- [ ] Error messages don't leak info
- [ ] API keys rotated regularly

---

## Incident Response

### Security Incident Procedure

1. **Detect**: Health monitoring alerts
2. **Isolate**: Disable affected services
3. **Investigate**: Review logs and access
4. **Contain**: Patch vulnerabilities
5. **Recovery**: Restore from clean backups
6. **Post-Incident**: RCA and improvements

### Emergency Contacts

```
Security Issues: security@lux-auto.com
Incident Response: +1-XXX-SEC-TEAM (24/7)
Bug Bounty: security@lux-auto.com
```

---

## Compliance

### Standards Compliance

- **OWASP Top 10**: Address all categories
- **GDPR**: User data protection
- **SOC 2**: Audit trail and access control
- **PCI DSS**: If processing payments (not currently)

---

## Security Checklist

- [ ] HTTPS/TLS enforced (443 only)
- [ ] RBAC implemented and tested
- [ ] Input validation on all fields
- [ ] Output encoding for XSS prevention
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Secrets stored securely
- [ ] Encryption at rest and in transit
- [ ] Audit logging operational
- [ ] Security headers configured
- [ ] Dependencies scanned
- [ ] Incident response plan documented

---

Last Updated: April 12, 2026
Version: 1.0
