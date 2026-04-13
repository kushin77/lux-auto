# Appsmith Dashboard Setup Guide

## Overview

This guide walks through setting up the four main Appsmith dashboards for the Lux-Auto platform:

1. **Deal Management Dashboard** - Create, review, and manage vehicle deals
2. **Buyer Network Management** - Manage buyer profiles and relationships
3. **Analytics Dashboard** - View metrics, trends, and performance data
4. **Admin Settings** - User management, API keys, audit logs, system configuration

---

## Prerequisites

- Appsmith instance running at `appsmith.lux.kushnir.cloud`
- Admin access to Appsmith
- FastAPI backend running and accessible
- Valid authentication tokens configured
- Applicable roles assigned (ANALYST, ADMIN, VIEWER)

---

## Import Process

### Step 1: Access Appsmith

1. Navigate to `https://appsmith.lux.kushnir.cloud`
2. Login with your Google account
3. Click **Create New** or **Import an App**

### Step 2: Import Dashboard

1. Select **File** → **Import**
2. Choose one of the JSON files:
   - `deal-management-dashboard.json`
   - `buyer-network-dashboard.json`
   - `analytics-dashboard.json`
   - `admin-settings-dashboard.json`
3. Click **Import**
4. The dashboard structure will be loaded

### Step 3: Configure API Data Source

For each dashboard, configure the API endpoints:

1. Go to **Datasources** (bottom left panel)
2. Find the query (e.g., `dealsQuery`)
3. Click **Edit Query**
4. Update the Base URL if needed: `https://lux.kushnir.cloud`
5. Verify headers include Authorization header
6. Test the connection
7. Save the datasource

### Step 4: Test Dashboard

1. Click **Run** or **Preview**
2. Verify data loads correctly
3. Test filters and interactions
4. Check that all API calls succeed

---

## Dashboard Configurations

### Deal Management Dashboard

**Purpose**: Create, review, approve, and manage vehicle deals

**Key Features**:
- Deal list with filtering (status, make, margin %)
- Real-time statistics (total deals, new deals, avg margin, revenue)
- Deal details modal for editing
- Status updates (new → reviewing → approved/rejected)
- Profit margin analysis
- Deal score visualization

**API Endpoints Required**:
- `GET /api/v2/deals` - List deals with filters
- `PUT /api/v2/deals/{id}` - Update deal status/details
- `POST /api/v2/deals` - Create new deal
- `DELETE /api/v2/deals/{id}` - Delete deal (admin only)

**Required Permissions**:
- `read:deals` - View deals
- `write:deals` - Edit deal details
- `approve:deals` - Change deal status (admin)

**Filters**:
- Status: All, New, Reviewing, Approved, Rejected
- Make: Vehicle make (Toyota, Honda, etc.)
- Margin %: Profit margin range slider

**Actions**:
- View deal details
- Edit deal information
- Change deal status
- Add internal notes

---

### Buyer Network Management Dashboard

**Purpose**: Manage buyer profiles, preferences, and track buyer relationships

**Key Features**:
- Buyer list with search and filtering
- Buyer statistics (total, active, avg match score, deals closed)
- Add/edit buyer modal
- Region-based filtering
- Match score tracking
- Deal closure history

**API Endpoints Required**:
- `GET /api/v2/buyers` - List buyers
- `POST /api/v2/buyers` - Create new buyer
- `PUT /api/v2/buyers/{id}` - Update buyer
- `DELETE /api/v2/buyers/{id}` - Delete buyer (admin)
- `GET /api/v2/buyers/{id}/deals` - Get buyer's deals

**Required Permissions**:
- `read:buyers` - View buyer network
- `write:buyers` - Add/modify buyers

**Filters**:
- Search: Name or email
- Status: Active, Inactive, Pending
- Region: Northeast, Southeast, Midwest, Southwest, West

**Actions**:
- Add new buyer
- Edit buyer profile
- Update contact information
- Track vehicle preferences
- View deal history

---

### Analytics Dashboard

**Purpose**: View performance metrics, trends, and comprehensive reporting

**Key Features**:
- KPI cards (deals/month, avg profit, win rate, YTD revenue)
- Multiple chart types (line, histogram, pie, bar)
- Deals over time trend
- Profit margin distribution
- Vehicle type breakdown
- Top buyers ranking
- Export to CSV/PDF
- Scheduled report generation

**API Endpoints Required**:
- `GET /api/v2/analytics` - Get analytics metrics
- `GET /api/v2/analytics/compliance` - Compliance report
- `GET /api/v2/analytics/export` - Export data

**Analytics Metrics Provided**:
- `deals_per_month` - Average deals per month
- `deals_trend` - Trend percentage (positive/negative)
- `avg_profit` - Average profit per deal
- `win_rate` - Percentage of approved deals
- `ytd_revenue` - Year-to-date total revenue
- `deals_timeline` - Historical deal data by date
- `margin_distribution` - Deals grouped by margin %
- `deals_by_type` - Deals grouped by vehicle type
- `top_buyers` - Top 10 buyers by deals closed

**Date Range Options**:
- Last 7 days
- Last 30 days
- Last 90 days
- Year-to-date
- Custom range

**Export Formats**:
- CSV - Spreadsheet format
- PDF - Formatted report
- Scheduled - Auto-send to email

---

### Admin Settings Dashboard

**Purpose**: System administration, user management, API keys, audit logging

**Key Features**:
- User management (add, edit, deactivate)
- Role assignment (Viewer, Analyst, Admin, Super Admin)
- API key generation and management
- Comprehensive audit log
- System settings configuration
- Maintenance actions (backup, cache clear, database vacuum)

**Tabs**:

#### User Management Tab
- List all users with roles and status
- Add new users
- Edit user profiles and roles
- Deactivate/reactivate users
- View last login information

API Endpoints:
- `GET /api/v2/users` - List users
- `POST /api/v2/users` - Create user
- `PUT /api/v2/users/{id}` - Update user
- `DELETE /api/v2/users/{id}` - Deactivate user

#### API Keys Tab
- Generate new API keys
- Set key name and scopes
- Configure expiration periods
- View key creation and usage
- Rotate/revoke keys

Scopes Available:
- `read:deals` - Read-only deal access
- `write:deals` - Create/modify deals
- `approve:deals` - Deal approval authority
- `read:buyers` - Read-only buyer access
- `write:buyers` - Create/modify buyers
- `read:analytics` - Analytics data access

API Endpoints:
- `GET /api/v2/api-keys` - List keys
- `POST /api/v2/api-keys` - Generate key
- `PUT /api/v2/api-keys/{id}/rotate` - Rotate key
- `DELETE /api/v2/api-keys/{id}` - Revoke key

#### Audit Logs Tab
- Filter logs by user, action, or date
- View all system events
- Track data changes
- Monitor access patterns

Logged Actions:
- User login/logout
- Deal create/update/delete
- Buyer import/modify
- Role assignment
- Settings changes
- API key creation/rotation
- Background job execution

API Endpoints:
- `GET /api/v2/audit-logs` - Search audit logs

#### System Settings Tab
- Configure site name and domain
- Set file upload limits
- Configure session timeouts
- Toggle audit logging
- Configure API rate limits
- Run backups
- Clear cache
- Vacuum database

API Endpoints:
- `PUT /api/v2/admin/settings` - Update settings
- `POST /api/v2/admin/backup` - Run backup
- `POST /api/v2/admin/cache/clear` - Clear Redis
- `POST /api/v2/admin/db/vacuum` - Vacuum DB

**Required Permissions**:
- `admin:users` - User management
- `admin:settings` - System settings
- `admin:audit` - View audit logs
- `super_admin` - All admin functions

---

## Data Source Configuration

### Base URL

All datasources should use the base URL:
```
https://lux.kushnir.cloud
```

Or for local development:
```
https://lux.kushnir.cloud
```

### Authentication

Add the following header to all requests:
```
Authorization: Bearer {{ appsmith.user.authToken }}
```

This automatically includes the user's authentication token from the Appsmith session.

### Common Query Parameters

#### Pagination
```
?page=1&per_page=50
```

#### Filtering
```
?status=approved&make=Toyota&min_margin=10&max_margin=50
```

#### Sorting
```
?sort_by=created_at&sort_order=desc
```

#### Date Range
```
?start_date=2024-01-01&end_date=2024-12-31
```

---

## Widget Binding Reference

### Using Appsmith Variables

**User Data**:
- `{{ appsmith.user.email }}` - Current user email
- `{{ appsmith.user.name }}` - Current user name
- `{{ appsmith.user.authToken }}` - Auth token

**Widget Values**:
- `{{ dealsTable.selectedRow.data }}` - Selected row data
- `{{ statusFilter.value }}` - Filter value
- `{{ marginFilter.value }}` - Range slider values [min, max]

**Query Results**:
- `{{ dealsQuery.data }}` - Query result data
- `{{ dealsQuery.isLoading }}` - Loading state
- `{{ dealsQuery.error }}` - Error message

### Dynamic Text Examples

```javascript
// Count deals
{{ dealsQuery.data?.length || 0 }}

// Calculate average
{{ (dealsQuery.data?.reduce((sum, d) => sum + d.margin, 0) / dealsQuery.data?.length || 0).toFixed(1) }}

// Format currency
${{ amount.toLocaleString() }}

// Format percentage
{{ (value * 100).toFixed(2) }}%

// Conditional text
{{ userRole === 'ADMIN' ? 'Full Access' : 'Limited Access' }}
```

---

## Security Considerations

### Row-Level Security (RLS)

The backend automatically enforces RBAC. Users can only see data they have permission to access:

**VIEWER** Role:
- Read all deals and buyers
- View analytics (read-only)
- Cannot approve or create deals
- Cannot manage users

**ANALYST** Role:
- Create and edit deals
- Manage buyers
- View analytics
- Cannot approve or delete
- Cannot access admin settings

**ADMIN** Role:
- Full deal management (CRUD + approval)
- Full buyer network management
- User management
- Audit log access
- Cannot access super admin functions

**SUPER_ADMIN** Role:
- Unrestricted access
- System settings
- API key management
- Database operations
- Backup/restore

### API Key Security

- Keys are shown only once on creation
- Store keys securely in environment variables or secrets managers
- Rotate keys regularly (90-day recommendation)
- Revoke compromised keys immediately
- Monitor key usage in audit logs

### Session Security

- Sessions timeout after 24 hours (configurable)
- SSO via Google OAuth protects credentials
- HTTPS enforces encryption in transit
- RBAC enforces authorization at API level

---

## Troubleshooting

### Datasource Connection Failed

**Problem**: "Cannot connect to API"

**Solution**:
1. Verify backend is running: `curl https://lux.kushnir.cloud/health`
2. Check firewall/proxy allows HTTPS
3. Verify Authorization header is correct
4. Check API credentials in environment

### No Data Displayed

**Problem**: Table is empty despite successful connection

**Solution**:
1. Check API response in browser console (F12 → Network)
2. Verify filters aren't hiding all results
3. Confirm user has appropriate RBAC permissions
4. Run query manually in Appsmith query editor

### Permission Denied Errors

**Problem**: 403 Forbidden responses

**Solution**:
1. Verify user role: **Admin Panel** → **Settings** → **Users**
2. Check required scopes for API key
3. Confirm authentication token is valid
4. Wait for role changes to propagate (may take 1 hour due to caching)

### Slow Dashboard Performance

**Problem**: Dashboard loads slowly or queries timeout

**Solution**:
1. Check API response times in Grafana
2. Reduce query result set (add filters)
3. Enable query caching (TTL settings)
4. Check database indexes are present
5. Scale API replicas if needed

### Charts Not Rendering

**Problem**: Chart widgets show blank or error

**Solution**:
1. Verify chart data format matches expected structure
2. Check x/y axis mappings are correct
3. Confirm data response includes required fields
4. Test with sample data in Appsmith editor

---

## Performance Optimization

### Caching Strategy

Configure query caching to reduce API calls:

1. Open query editor
2. Set **Cache Response** to On
3. Set **TTL** appropriate to data freshness needs:
   - Real-time data: None
   - Sales data: 5-15 minutes
   - Analytics: 30-60 minutes
   - Reference data: 1+ hour

Example:
```json
{
  "cache": {
    "enabled": true,
    "ttl": 300  // 5 minutes in seconds
  }
}
```

### Query Optimization

- Add pagination to large tables (50-100 rows per page)
- Use filters to reduce dataset size
- Lazy load charts (load on demand)
- Preload critical data during page load

---

## Maintenance & Updates

### Regular Tasks

**Daily**:
- Monitor dashboard performance
- Check error rates
- Review audit logs for anomalies

**Weekly**:
- Test all filters and interactions
- Verify API connectivity
- Check data accuracy

**Monthly**:
- Review and optimize slow queries
- Update API endpoints if changed
- Backup dashboard configurations

### Backup & Recovery

Export dashboard configurations regularly:

1. **Appsmith Dashboard** → **Export App**
2. Store JSON in version control
3. Test import process on staging

To restore:
1. Create new Appsmith app
2. Import JSON backup
3. Reconfigure datasources if needed

---

## Support & Troubleshooting

For issues:

1. **Check Appsmith Logs**: Admin Panel → Logs
2. **Check API Logs**: `docker logs lux-fastapi`
3. **Test API Manually**: Use Postman or curl
4. **Contact Support**: ops@lux-auto.com

Common error codes:
- **401 Unauthorized** - Invalid/expired token
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource doesn't exist
- **500 Server Error** - Backend issue

---

## Next Steps

1. Deploy dashboards to production Appsmith instance
2. Configure OAuth integration for SSO
3. Set up monitoring/alerting for dashboard health
4. Train team members on dashboard usage
5. Document custom workflows and business processes

---

Last Updated: April 12, 2026
Version: 1.0
