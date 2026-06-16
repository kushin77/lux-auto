# Appsmith Portal Configuration & Setup Guide

## Overview

This guide documents the setup and configuration of the Appsmith low-code portal for Lux-Auto deal management.

## Appsmith App Structure

```
Lux-Auto Portal
├── Dashboard Page (entry point, deal pipeline view)
├── Deal Management
│   ├── Deal List Page (table view with filters)
│   ├── Deal Detail Page (complete deal information)
│   └── Deal Bulk Operations (approve/reject multiple)
├── Buyer Network
│   ├── Buyer List Page (table view)
│   ├── Buyer Import Modal (CSV upload)
│   ├── Buyer Edit Modal (profile editor)
│   └── Buyer Preferences (make/model selection)
├── Analytics 
│   ├── Dashboard Page (KPI cards, charts)
│   ├── Win Rate Analysis
│   ├── Margin Distribution
│   ├── ROI by Make/Model
│   └── Custom Report Builder
├── Admin Panel
│   ├── User Management (list, roles, permissions)
│   ├── Audit Log Viewer (searchable, filterable)
│   ├── System Settings (configuration editor)
│   └── API Key Management (create, revoke, rotate)
└── Navigation & Common Components
    ├── Top Navigation Bar (user menu, notifications)
    ├── Sidebar Navigation (collapsible menu)
    ├── Search Component (deal/buyer search)
    └── Settings Panel (theme, preferences)
```

## Data Sources (FastAPI Connection)

### API Base URL
```
https://lux.kushnir.cloud/api/v2
```

### Authentication
All requests require OAuth2 token via:
```
Authorization: Bearer {JWT_TOKEN}
```

Appsmith automatically includes the token from session cookies set by oauth2-proxy.

## Queries (Example)

### List Deals Query
```javascript
{
  name: "listDeals",
  method: "GET",
  url: "{{appConfig.apiBase}}/deals?skip={{dealTable.pageNo * dealTable.pageSize}}&limit={{dealTable.pageSize}}&status={{statusFilter.value}}&sort_by={{dealTable.sortedColumn}}&order={{dealTable.sortDirection}}",
  headers: {
    Authorization: "Bearer {{appState.bearerToken}}"
  }
}
```

### Approve Deal Query
```javascript
{
  name: "approveDeal",
  method: "POST",
  url: "{{appConfig.apiBase}}/deals/{{selectedDeal.id}}/approve",
  headers: {
    Authorization: "Bearer {{appState.bearerToken}}",
    "Content-Type": "application/json"
  },
  body: {
    reason: "{{approvalReasonInput.value}}",
    notify_agent: true
  }
}
```

### Import Buyers Query
```javascript
{
  name: "importBuyers",
  method: "POST",
  url: "{{appConfig.apiBase}}/buyers/import",
  headers: {
    Authorization: "Bearer {{appState.bearerToken}}"
  },
  enctype: "multipart/form-data",
  formData: {
    file: "{{buyerFileUpload.files[0].data}}"
  }
}
```

## Page Configurations

### Dashboard Page (Landing)
- Deal Pipeline Kanban (columns: Scanning, Scored, Bidding, Won, Routed, Closed)
- Quick Stats Cards (Total Deals, Win Rate, Avg Margin, ROI)
- Recent Activity Feed (last 10 deals/actions)
- Search Bar (filter by VIN, make, model)

**Components**:
- KanbanBoard widget showing deal pipeline
- StatCard widget (x4) for key metrics
- Table widget for recent activity
- SearchInput widget with autocomplete

### Deal List Page
- Table of all deals with columns: VIN, Year, Make, Model, Score, Margin, Status, Created
- Advanced Filters: Status, Make, Model, Min Score, Max Price
- Sorting: Click column headers
- Pagination: Skip/Limit or Cursor-based
- Bulk Actions: Approve Multiple, Assign to Agent, Tag, Export

**Components**:
- FilterSidebar (collapsible, multiple filters)
- DataTable (sortable, paginated, selectable rows)
- BulkActionsToolbar (appears when rows selected)
- ActionButtons (detail, approve, reject, delete)

### Deal Detail Page
- Complete deal information (VIN, year, make, model, mileage, condition, etc.)
- Photo carousel/gallery
- Bid history timeline
- Matched buyers list with scores
- Action buttons (Approve, Reject, Assign)
- Audit trail/history

**Components**:
- TabbedPanel (Overview, Bids, Buyers, History)
- ImageCarousel (dealer photos)
- Timeline widget (bid history)
- Table widget (matched buyers)
- Modal buttons for approve/reject

### Buyer List Page
- Table of all buyers with columns: Name, Location, Email, Phone, Max Price, Recent Purchase
- Filters: Status (active/inactive/archived), Sort by
- Import Button (triggers CSV upload modal)
- Add Buyer Button (launches buyer form)
- Actions: Edit, Delete, View Match History

**Components**:
- DataTable widget (buyers)
- FilterBar (status filter)
- Modal for import (file upload)
- Modal for add/edit buyer
- DetailPanel for buyer preferences/history

### Analytics Dashboard
- Win Rate Chart (line graph by time period)
- Margin Distribution (histogram)
- ROI by Make/Model (bar chart, sorted)
- Agent Accuracy Metrics (percentage widget)
- Deal Velocity (deals per day trend)
- Buyer Performance Leaderboard (top 10)
- Date Range Picker (7d, 30d, 90d, custom)

**Components**:
- AnalyticsChart widgets (line, bar, histogram)
- StatCard widgets (percentages, numbers)
- Table widget (leaderboard)
- DateRangePicker (custom date selection)
- Export Button (CSV/PDF)

### Admin Panel
- User Management Table (email, name, role, created_at, last_login)
- Role Assignment Dropdown (VIEWER, ANALYST, ADMIN, SUPER_ADMIN)
- Permission Matrix display
- Audit Log Viewer (searchable, filterable by date range/user/entity)
- System Settings Editor (read-only for non-SUPER_ADMIN)
- API Key Management (list, create, revoke, rotate)

**Components**:
- DataTable widgets
- SelectDropdown for role assignment
- Modal for API key creation
- RichText editor for settings (read-only mode)
- AuditLogViewer (custom component or table)

## RBAC Implementation in Appsmith

### Role-Based UI Rendering
```javascript
// Show/hide based on user role
{
  hidden: !["ADMIN", "SUPER_ADMIN"].includes(appState.userRole)
}
```

### Permission-Based Actions
```javascript
// Disable buttons based on permission
{
  disabled: !appState.userPermissions.includes("approve:deals")
}
```

### Data Filtering
```javascript
// Only show user's assigned deals
{
  url: "{{appConfig.apiBase}}/deals?assigned_to={{appState.userId}}"
}
```

## Security Considerations

1. **Token Management**: Appsmith maintains session tokens from oauth2-proxy
2. **CORS**: Configure CORS to allow appsmith.kushnir.cloud
3. **API Rate Limiting**: Implement per-role limits at FastAPI level
4. **Data Masking**: Don't display sensitive info (API keys, passwords)
5. **Audit Logging**: Log all portal interactions via API endpoint
6. **Session Timeout**: Implement cookie expiration (24 hours default)

## Theme Configuration

### Custom Branding
- Company Logo (in header)
- Color Scheme (primary: blue, secondary: gray)
- Font: System fonts (Segoe UI, Roboto)
- Dark Mode Support (toggle in settings)

### Responsive Design
- Mobile: Stack layout vertically
- Tablet: 2-column grid
- Desktop: Full layout with sidebar

## Performance Optimization

### Caching Strategy
- Cache deal list for 5 minutes
- Cache analytics for 30 minutes
- Cache buyer network for 10 minutes
- Invalidate on create/update actions

### Pagination
- Deal table: 50 items per page
- Buyer table: 50 items per page
- Audit logs: 100 items per page
- Analytics: aggregate all data (pagination optional)

### Search/Filter
- Debounce search input (500ms)
- Pre-load filter options (make/model lists)
- Use lazy loading for large tables

## Real-Time Updates (WebSocket)

### Integration
- Connect to `wss://lux.kushnir.cloud/ws/deals`
- Listen for `deal_updated` messages
- Auto-refresh affected rows
- Show toast notifications for important events

### Update Types
- `deal_approved`: Refresh dashboard, move Kanban card
- `deal_won`: Show notification, update stats
- `deal_rejected`: Refresh list
- `metrics_updated`: Update analytics widgets

## Deployment Steps

1. **Create Appsmith Account** (if not exists)
2. **Create New App** "Lux-Auto Portal"
3. **Add API Data Source**
   - URL: https://lux.kushnir.cloud
   - Auth: Use OAuth2 token from session
4. **Import/Build Pages** (see structure above)
5. **Configure Widgets**
   - Bind datasources to tables, charts
   - Setup click handlers for actions
   - Configure buttons for approve/reject/import
6. **Test Workflows**
   - List deals → Detail → Approve
   - Import buyers → View matches
   - View analytics → Export report
7. **Deploy** to Production URL
8. **Configure DNS** for appsmith.lux.kushnir.cloud

## Testing Checklist

- [ ] Dashboard loads and displays stats
- [ ] Deal table loads with pagination
- [ ] Deal detail page shows complete info
- [ ] Approve deal button works and updates list
- [ ] Buyer import accepts CSV and validates
- [ ] Analytics dashboard shows charts
- [ ] Admin panel shows only to ADMIN+
- [ ] WebSocket updates work (if implemented)
- [ ] Dark mode toggle works
- [ ] Mobile responsive design works
- [ ] Export functionality works
- [ ] Audit logs viewable by ADMIN+

## Known Limitations

1. Appsmith has 100MB file size limit for components
2. Real-time updates require WebSocket plugin (may need custom)
3. Complex calculations may timeout (use backend for aggregations)
4. Limited mobile responsiveness (Appsmith strength is desktop)
5. Custom CSS limited for styling (use Appsmith themes)

## Troubleshooting

**Issue**: Queries return 401 Unauthorized
**Solution**: Ensure oauth2-proxy headers are passed, check token expiration

**Issue**: Table doesn't update after bulk action
**Solution**: Add refresh query call in action handler

**Issue**: CSV import fails with validation errors
**Solution**: Check CSV format matches API spec, ensure headers match expected columns

**Issue**: Real-time updates not working
**Solution**: Check WebSocket connection in browser DevTools, verify user_id passed correctly

## Next Steps

1. Create Appsmith app instance in lux.kushnir.cloud workspace
2. Build Dashboard page first (highest visibility)
3. Build Deal Management pages (core functionality)
4. Build Buyer Management (secondary)
5. Build Analytics (reporting)
6. Build Admin Panel (compliance)
7. Deploy to production
8. Gather user feedback and iterate

