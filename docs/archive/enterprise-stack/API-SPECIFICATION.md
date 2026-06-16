# Portal API Specification (v2)

## Endpoint Categories

### 1. Deal Management API

#### List Deals
```
GET /api/v2/deals
```

**Query Parameters**:
- `skip` (int, default: 0) - Pagination offset
- `limit` (int, default: 50, max: 500) - Items per page
- `status` (enum) - Filter by status: scanning|scored|bidding|won|routed|closed
- `make` (string) - Filter by vehicle make
- `model` (string) - Filter by vehicle model
- `min_score` (float) - Minimum deal score
- `max_price` (decimal) - Maximum estimated value
- `sort_by` (string, default: created_at) - Sort column
- `order` (enum, default: desc) - Sort order: asc|desc

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "deal-123",
      "vin": "WVWZZZ3CZ9E123456",
      "year": 2019,
      "make": "Volkswagen",
      "model": "Jetta",
      "photo_url": "https://...",
      "mmr_value": 8500.00,
      "estimated_margin": 1200.00,
      "score": 78.5,
      "status": "bidding",
      "created_at": "2024-04-12T10:30:00Z",
      "updated_at": "2024-04-12T10:30:00Z"
    }
  ],
  "total": 245,
  "skip": 0,
  "limit": 50,
  "hasMore": true
}
```

**Status codes**:
- 200: Success
- 401: Unauthorized (missing auth header)
- 403: Forbidden (insufficient permissions)
- 422: Invalid query parameters

**Permissions required**: `read:deals`

---

#### Get Deal Detail
```
GET /api/v2/deals/{deal_id}
```

**Response** (200 OK):
```json
{
  "id": "deal-123",
  "vin": "WVWZZZ3CZ9E123456",
  "year": 2019,
  "make": "Volkswagen",
  "model": "Jetta",
  "trim": "S Manual",
  "body_style": "Sedan",
  "mileage": 95000,
  "transmission": "Manual",
  "color": "Blue",
  "interior_color": "Gray",
  "fuel_type": "Gasoline",
  "engine": "1.4L 4-Cylinder",
  "photo_urls": ["https://...", "https://..."],
  "mmr_value": 8500.00,
  "condition_report": {
    "exterior": "Good",
    "interior": "Good",
    "mechanical": "Excellent",
    "issues": ["Small paint chip on door", "Tire tread 6/32"]
  },
  "score": 78.5,
  "score_breakdown": {
    "price_score": 85,
    "condition_score": 72,
    "demand_score": 75,
    "margin_score": 80
  },
  "status": "bidding",
  "bid_history": [
    {
      "bid_amount": 7200.00,
      "bid_time": "2024-04-12T10:35:00Z",
      "bidder_rank": 3
    }
  ],
  "matched_buyers": [
    {
      "buyer_id": "buyer-456",
      "buyer_name": "ABC Motors",
      "match_score": 92,
      "interested": true
    }
  ],
  "created_at": "2024-04-12T10:30:00Z",
  "updated_at": "2024-04-12T10:30:00Z"
}
```

**Permissions required**: `read:deals`

---

#### Approve Deal
```
POST /api/v2/deals/{deal_id}/approve
```

**Request body**:
```json
{
  "reason": "Good margin and condition",
  "notify_agent": true
}
```

**Response** (200 OK):
```json
{
  "id": "deal-123",
  "status": "bidding",
  "approved_at": "2024-04-12T10:45:00Z",
  "approved_by": "user-789"
}
```

**Status codes**:
- 200: Success
- 400: Deal already approved/rejected
- 401: Unauthorized
- 403: Forbidden
- 404: Deal not found

**Permissions required**: `approve:deals`

---

#### Reject Deal
```
POST /api/v2/deals/{deal_id}/reject
```

**Request body** (required):
```json
{
  "reason": "Insufficient margin, mileage too high"
}
```

**Response** (200 OK):
```json
{
  "id": "deal-123",
  "status": "closed",
  "rejected_at": "2024-04-12T10:45:00Z",
  "rejected_by": "user-789",
  "rejection_reason": "Insufficient margin, mileage too high"
}
```

**Permissions required**: `approve:deals`

---

### 2. Buyer Management API

#### List Buyers
```
GET /api/v2/buyers
```

**Query Parameters**:
- `skip` (int, default: 0)
- `limit` (int, default: 50)
- `status` (enum) - active|inactive|archived
- `sort_by` (string) - name|location|recent_purchase
- `order` (enum) - asc|desc

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "buyer-456",
      "name": "ABC Motors",
      "location": "Miami, FL",
      "contact_email": "buyer@abcmotors.com",
      "contact_phone": "305-555-1234",
      "max_price": 15000.00,
      "preferred_makes": ["Honda", "Toyota", "Mazda"],
      "recent_purchase": "2024-04-10",
      "total_purchases": 12,
      "response_rate": 0.85
    }
  ],
  "total": 45,
  "skip": 0,
  "limit": 50
}
```

**Permissions required**: `read:buyers`

---

#### Import Buyers (CSV)
```
POST /api/v2/buyers/import
```

**Content-Type**: multipart/form-data

**Form parameters**:
- `file` (file) - CSV file with columns: name, email, phone, max_price, preferred_makes, location

**Sample CSV**:
```
Name,Email,Phone,MaxPrice,PreferredMakes,Location
ABC Motors,buyer@abcmotors.com,305-555-1234,15000,"Honda,Toyota,Mazda",Miami FL
XYZ Wholesale,sales@xyzwholesale.com,770-555-5678,20000,"Ford,Chevrolet,RAM",Atlanta GA
```

**Response** (200 OK):
```json
{
  "imported": 45,
  "updated": 3,
  "failed": 2,
  "errors": [
    {
      "row": 10,
      "error": "Invalid email format: buyer123@invalid"
    }
  ]
}
```

**Status codes**:
- 200: Success (with possible errors)
- 400: Invalid file format
- 413: File too large (>10MB)
- 422: CSV validation failed

**Permissions required**: `write:buyers`

---

### 3. Analytics API

#### Dashboard Summary
```
GET /api/v2/analytics/dashboard
```

**Query Parameters**:
- `date_range` (string, default: 30d) - 7d|30d|90d|ytd|custom
- `start_date` (date) - ISO format, required if date_range=custom
- `end_date` (date) - ISO format, required if date_range=custom

**Response** (200 OK):
```json
{
  "period": "30d",
  "metrics": {
    "deals_scanned": 124,
    "deals_won": 34,
    "win_rate": 0.274,
    "total_volume": 425600.00,
    "total_margin": 78920.00,
    "avg_margin_per_deal": 2321.76,
    "roi": 0.1856
  },
  "trends": {
    "win_rate_vs_previous": 0.034,
    "margin_vs_previous": 0.052
  },
  "top_makes": [
    {
      "make": "Honda",
      "deals_won": 8,
      "avg_margin": 2500.00
    }
  ]
}
```

**Permissions required**: `read:analytics`

---

#### Deal Performance Analytics
```
GET /api/v2/analytics/deals
```

**Query Parameters**:
- `metric` (enum) - win_rate|margin|velocity|accuracy
- `group_by` (enum) - make|model|month|week|day
- `date_range` (string) - 7d|30d|90d|ytd

**Example** (metric=win_rate, group_by=make):

**Response** (200 OK):
```json
{
  "metric": "win_rate",
  "group_by": "make",
  "data": [
    {
      "group": "Honda",
      "value": 0.35,
      "deals_total": 20,
      "deals_won": 7,
      "trend": 0.05
    },
    {
      "group": "Toyota",
      "value": 0.28,
      "deals_total": 18,
      "deals_won": 5,
      "trend": -0.02
    }
  ]
}
```

**Permissions required**: `read:analytics`

---

### 4. Audit Log API

#### Get Audit Logs
```
GET /api/v2/audit-logs
```

**Query Parameters**:
- `skip` (int, default: 0)
- `limit` (int, default: 100, max: 1000)
- `user_id` (UUID) - Filter by specific user
- `entity_type` (string) - deals|buyers|settings
- `action` (string) - create|update|delete|approve|reject
- `start_date` (datetime) - ISO format
- `end_date` (datetime) - ISO format

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": 1234,
      "user_id": "user-123",
      "user_email": "analyst@example.com",
      "action": "approve",
      "entity_type": "deal",
      "entity_id": "deal-456",
      "old_values": null,
      "new_values": {
        "status": "approved",
        "approved_at": "2024-04-12T10:45:00Z"
      },
      "ip_address": "203.0.113.45",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-04-12T10:45:00Z"
    }
  ],
  "total": 1256,
  "skip": 0,
  "limit": 100
}
```

**Status codes**:
- 200: Success
- 401: Unauthorized
- 403: Forbidden (requires `read:audit`)

**Permissions required**: `read:audit` (ADMIN or SUPER_ADMIN)

---

### 5. User & Role Management API

#### List Users
```
GET /api/v2/users
```

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "user-123",
      "email": "analyst@example.com",
      "name": "John Analyst",
      "roles": ["ANALYST"],
      "created_at": "2024-01-15T09:00:00Z",
      "last_login": "2024-04-12T10:30:00Z",
      "is_active": true
    }
  ],
  "total": 12
}
```

**Permissions required**: `manage:users` (ADMIN+)

---

#### Assign Role to User
```
POST /api/v2/users/{user_id}/roles
```

**Request body**:
```json
{
  "role": "ADMIN",
  "expires_at": null
}
```

**Response** (200 OK):
```json
{
  "user_id": "user-123",
  "role": "ADMIN",
  "assigned_at": "2024-04-12T10:45:00Z",
  "assigned_by": "user-999",
  "expires_at": null
}
```

**Permissions required**: `manage:users` (SUPER_ADMIN only)

---

### 6. API Keys Management

#### Create API Key
```
POST /api/v2/api-keys
```

**Request body**:
```json
{
  "name": "Appsmith Integration",
  "scopes": ["read:deals", "write:deals", "read:analytics"]
}
```

**Response** (200 OK):
```json
{
  "id": 1234,
  "name": "Appsmith Integration",
  "key": "lux_abc12345_xyz789opqrst",
  "prefix": "lux_abc12345",
  "scopes": ["read:deals", "write:deals", "read:analytics"],
  "created_at": "2024-04-12T10:45:00Z",
  "expires_at": "2025-04-12T10:45:00Z"
}
```

**Note**: Full key only returned once. Store securely!

---

#### List API Keys
```
GET /api/v2/api-keys
```

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": 1234,
      "name": "Appsmith Integration",
      "prefix": "lux_abc12345",
      "scopes": ["read:deals", "write:deals", "read:analytics"],
      "last_used_at": "2024-04-12T10:30:00Z",
      "expires_at": "2025-04-12T10:45:00Z",
      "is_active": true
    }
  ]
}
```

---

## Authentication

All endpoints (except `/health`) require:

```
Authorization: Bearer {JWT_TOKEN}
```

Or for API keys:

```
Authorization: Bearer {API_KEY}
```

## Error Responses

Standard error response format:

```json
{
  "detail": "Error message",
  "error_code": "INVALID_REQUEST",
  "status": 422,
  "timestamp": "2024-04-12T10:45:00Z"
}
```

**Common status codes**:
- 401: Unauthorized (missing/invalid auth)
- 403: Forbidden (insufficient permissions)
- 404: Resource not found
- 422: Validation error
- 429: Rate limit exceeded
- 500: Internal server error

## Rate Limiting

Based on user role:

| Role | Limit | Window |
|------|-------|--------|
| VIEWER | 100 | 1 hour |
| ANALYST | 500 | 1 hour |
| ADMIN | 1,000 | 1 hour |
| SUPER_ADMIN | unlimited | - |

Response headers:
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1712956800
```

## Pagination

All list endpoints support cursor-based pagination:

```
skip: Offset (0-indexed)
limit: Items per page (1-500, default 50)
```

Response includes:
- `items`: Array of results
- `total`: Total count
- `hasMore`: Boolean indicating more results available

## Versioning

- Current version: `v2`
- Deprecated version: `v1` (until 2025-Q2)
- New endpoints should always be in latest version

