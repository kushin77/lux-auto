# Lux-Auto Portal - User Guide

## Getting Started

### Logging In
1. Navigate to https://lux.kushnir.cloud
2. You'll be redirected to the Google login
3. Sign in with your company Google account
4. You'll be granted access based on your role

### User Roles and Permissions

#### VIEWER
- Read access to deals, buyers, analytics
- Can view reports and dashboards
- Cannot make changes

#### ANALYST
- Read/write access to deals and buyers
- Can run analytics and export reports
- Can approve/reject deals for bidding
- Can import and manage buyers

#### ADMIN
- Full access to all features
- Can manage users and roles
- Can access audit logs
- Can configure system settings

#### SUPER_ADMIN
- Unrestricted access to all features
- Can manage admins
- Can configure advanced settings

---

## Deal Management Dashboard

### Viewing Deals
1. Click **Deal Dashboard** in the main menu
2. Deals are displayed in a Kanban board by status
3. Use filters on the left sidebar to narrow results

### Deal Status Flow
- **Scanning**: Deal detected, pending evaluation
- **Scored**: Deal evaluated with score assigned
- **Bidding**: Open for buyer bidding
- **Won**: Bid won, ready to route to buyer
- **Routed**: Deal assigned to winning buyer
- **Closed**: Deal completed

### Managing Deals

#### View Deal Details
- Click any deal card to see full details including:
  - Vehicle specs (year, make, model, color, mileage)
  - Photos and condition report
  - Score breakdown (price, condition, demand, margin)
  - Bid history
  - Buyer information

#### Approve Deal for Bidding
1. Click the deal card
2. Click **Approve** button (requires ANALYST role or higher)
3. Confirm the action
4. Deal moves to "Bidding" status

#### Reject Deal
1. Click the deal card
2. Click **Reject** button
3. Enter rejection reason
4. Deal moves to "Closed" status

#### Bulk Operations
1. Select multiple deals using checkboxes
2. Click **Bulk Actions** dropdown
3. Choose action:
   - Approve Selected
   - Reject Selected
   - Assign to Buyer
   - Export as CSV

---

## Buyer Management

### Viewing Buyers
1. Click **Buyer Network** in the main menu
2. All active buyers are listed in a table
3. Sort by any column or search by name/email

### Buyer Match Score
- Score shows how likely a buyer is to purchase a deal
- 0-25: Low interest in this deal
- 26-50: Some interest
- 51-75: Good match
- 76-100: Excellent match

### Adding a Buyer Manually
1. Click **+ Add Buyer** button
2. Enter buyer information:
   - Name and contact email
   - Phone number (optional)
   - Address and location
   - Vehicle make preferences
   - Price range
3. Click **Create**

### Importing Buyers from CSV
1. Click **Import** button
2. Select CSV file with buyer data
3. Required columns: name, email, makes, models, min_price, max_price
4. System validates data and shows any errors
5. Click **Confirm Import**
6. Buyers are added to your network

### Editing Buyer Preferences
1. Find buyer in list
2. Click the buyer row or **Edit** button
3. Update preferences:
   - Make/model interests
   - Location territory
   - Price range
   - Contact preferences
4. Click **Save**

---

## Analytics & Reporting

### Dashboard Metrics
The Analytics dashboard shows key performance indicators:
- **Total Deals**: All deals in system
- **Status Breakdown**: Deals by stage
- **Average Score**: Mean deal score across all deals
- **Total Buyers**: Number of active buyers
- **Average Margin**: Mean estimated profit per deal

### Deal Performance Analytics
- **Win Rate**: Percentage of deals successfully sold
- **Margin Distribution**: Histogram of profit ranges
- **Deal Velocity**: Deals/day trend
- **ROI by Make/Model**: Which vehicles are most profitable

### Buyer Performance Leaderboard
- Top buyers by success rate
- Contact frequency and response time
- Total deals purchased
- Average purchase price

### Custom Reports
1. Click **+ New Report**
2. Select metrics to include
3. Choose date range
4. Set filters (make, model, status, etc.)
5. Choose visualization (table, chart, etc.)
6. Save or export

### Exporting Data
- **Excel**: Click **Export to Excel**
- **CSV**: Click **Export to CSV**
- **PDF**: Click **Export to PDF** (includes charts)

---

## Real-Time Updates

### Live Deal Updates
- When a deal status changes, all users see it immediately
- If you're viewing a deal dashboard, new deals appear in real-time
- No need to refresh the page

### Notifications
- New deals available: Browser notification
- Deal won by your preferred buyer: Highlight in dashboard
- Low margin deal available: Alert notification
- Buyer outreach needed: Notification

To manage notifications:
1. Click your profile in top right
2. Click **Settings**
3. Toggle notification types on/off

---

## Admin Settings

### User Management
1. Click **Settings** → **Users**
2. View all users, their roles, and access levels
3. To add user: Click **+ Add User**
4. To modify: Click user row and edit
5. To remove: Click user and select **Deactivate**

### Role Assignment
1. Go to **Settings** → **Users**
2. Click the user to edit
3. Select their role from dropdown
4. Click **Save**

### System Configuration
1. Go to **Settings** → **System**
2. Configure:
   - Deal pagination limit (default 50)
   - Analytics refresh interval
   - Notification preferences
   - Email server settings

### Audit Logs
1. Go to **Settings** → **Audit Logs**
2. View all system actions with:
   - Who performed the action
   - When it happened
   - What changed
   - Their IP address
3. Filter by date, user, or action type
4. Export audit log as CSV

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Show all shortcuts |
| `d` | Go to Deal Dashboard |
| `b` | Go to Buyer Network |
| `a` | Go to Analytics |
| `s` | Open Settings |
| `/` | Search deals and buyers |
| `esc` | Close modals |
| `enter` | Confirm action |

---

## Troubleshooting

### I can't see the Deal Dashboard
- Check your user role (minimum VIEWER)
- Verify your are logged in (look for profile icon in top right)
- Try refreshing the page

### Deals aren't updating in real-time
- Check your internet connection
- Refresh the page
- Ensure WebSocket connection is not blocked by firewall

### CSV import is failing
- Verify your file is valid CSV format
- Check that required columns are present: name, email, makes, models, min_price, max_price
- Ensure all rows have complete data
- File size must be < 10MB

### I can't export analytics
- Ensure you have ANALYST role or higher
- Try a different format (CSV instead of Excel)
- Clear browser cache and try again

---

## Support

For technical support or questions:
- Email: support@lux-auto.com
- Slack: #lux-auto-support
- Documentation: https://docs.lux-auto.com

---

Last Updated: April 12, 2026
