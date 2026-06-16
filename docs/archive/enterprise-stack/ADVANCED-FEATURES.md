# Advanced Portal Features Configuration

## Dark Mode & Theme Customization

### Theme Configuration

```json
{
  "themes": {
    "light": {
      "id": "light",
      "name": "Light Mode",
      "description": "Default light theme",
      "isPrimary": true,
      "colors": {
        "primary": "#1976D2",
        "secondary": "#DC004E",
        "success": "#4CAF50",
        "warning": "#FF9800",
        "error": "#F44336",
        "info": "#2196F3",
        "background": "#FFFFFF",
        "surface": "#F5F5F5",
        "surfaceVariant": "#EEEEEE",
        "onBackground": "#1A1A1A",
        "onSurface": "#424242",
        "outline": "#BDBDBD"
      },
      "typography": {
        "fontFamily": "Roboto, Helvetica, Arial, sans-serif",
        "fontSize": {
          "xs": "12px",
          "sm": "14px",
          "base": "16px",
          "lg": "18px",
          "xl": "20px"
        },
        "fontWeight": {
          "light": 300,
          "regular": 400,
          "medium": 500,
          "semibold": 600,
          "bold": 700
        }
      },
      "spacing": {
        "xs": "4px",
        "sm": "8px",
        "base": "16px",
        "lg": "24px",
        "xl": "32px"
      },
      "borderRadius": {
        "sm": "4px",
        "base": "8px",
        "lg": "12px",
        "xl": "16px"
      },
      "shadows": {
        "sm": "0 1px 2px 0 rgba(0,0,0,0.05)",
        "base": "0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px 0 rgba(0,0,0,0.06)",
        "lg": "0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05)",
        "xl": "0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04)"
      }
    },
    "dark": {
      "id": "dark",
      "name": "Dark Mode",
      "description": "Dark theme for reduced eye strain",
      "isPrimary": false,
      "colors": {
        "primary": "#64B5F6",
        "secondary": "#F48FB1",
        "success": "#81C784",
        "warning": "#FFB74D",
        "error": "#EF5350",
        "info": "#64B5F6",
        "background": "#121212",
        "surface": "#1E1E1E",
        "surfaceVariant": "#2C2C2C",
        "onBackground": "#FFFFFF",
        "onSurface": "#E0E0E0",
        "outline": "#424242"
      },
      "typography": {
        "fontFamily": "Roboto, Helvetica, Arial, sans-serif",
        "fontSize": {
          "xs": "12px",
          "sm": "14px",
          "base": "16px",
          "lg": "18px",
          "xl": "20px"
        },
        "fontWeight": {
          "light": 300,
          "regular": 400,
          "medium": 500,
          "semibold": 600,
          "bold": 700
        }
      },
      "spacing": {
        "xs": "4px",
        "sm": "8px",
        "base": "16px",
        "lg": "24px",
        "xl": "32px"
      },
      "borderRadius": {
        "sm": "4px",
        "base": "8px",
        "lg": "12px",
        "xl": "16px"
      },
      "shadows": {
        "sm": "0 1px 2px 0 rgba(0,0,0,0.3)",
        "base": "0 1px 3px 0 rgba(0,0,0,0.3),0 1px 2px 0 rgba(0,0,0,0.2)",
        "lg": "0 10px 15px -3px rgba(0,0,0,0.4),0 4px 6px -2px rgba(0,0,0,0.1)",
        "xl": "0 20px 25px -5px rgba(0,0,0,0.4),0 10px 10px -5px rgba(0,0,0,0.2)"
      }
    },
    "high-contrast": {
      "id": "high-contrast",
      "name": "High Contrast",
      "description": "High contrast theme for accessibility",
      "isPrimary": false,
      "colors": {
        "primary": "#0066CC",
        "secondary": "#FF0066",
        "success": "#006600",
        "warning": "#FF6600",
        "error": "#CC0000",
        "info": "#0066CC",
        "background": "#000000",
        "surface": "#FFFFFF",
        "surfaceVariant": "#F0F0F0",
        "onBackground": "#FFFFFF",
        "onSurface": "#000000",
        "outline": "#000000"
      },
      "typography": {
        "fontFamily": "Arial, sans-serif",
        "fontSize": {
          "xs": "14px",
          "sm": "16px",
          "base": "18px",
          "lg": "20px",
          "xl": "22px"
        },
        "fontWeight": {
          "light": 400,
          "regular": 700,
          "medium": 700,
          "semibold": 700,
          "bold": 700
        }
      }
    }
  }
}
```

### Implementing Dark Mode in Appsmith

```javascript
// In dashboard settings (e.g., deal-management-dashboard.js)
class DashboardTheme {
  constructor() {
    this.currentTheme = this.getStoredTheme() || 'light';
    this.themes = this.loadThemes();
  }

  getStoredTheme() {
    // Check local storage for saved theme
    return localStorage.getItem('lux-auto-theme');
  }

  setTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) return;

    // Apply theme colors
    document.documentElement.style.setProperty(
      '--color-primary',
      theme.colors.primary
    );
    document.documentElement.style.setProperty(
      '--color-background',
      theme.colors.background
    );
    document.documentElement.style.setProperty(
      '--color-surface',
      theme.colors.surface
    );
    document.documentElement.style.setProperty(
      '--color-onBackground',
      theme.colors.onBackground
    );

    // Store preference
    localStorage.setItem('lux-auto-theme', themeName);
    this.currentTheme = themeName;

    // Update body class for CSS overrides
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${themeName}`);
  }

  toggleDarkMode() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  getTheme(themeName) {
    return this.themes[themeName];
  }
}

// Usage in Appsmith queries
const themeManager = new DashboardTheme();
export default themeManager;
```

### Theme Toggle Widget

```json
{
  "widgetName": "ThemeToggle",
  "type": "CONTAINER_WIDGET",
  "topRow": 0.5,
  "leftColumn": 22,
  "rightColumn": 24,
  "children": [
    {
      "widgetName": "ThemeButton",
      "type": "BUTTON_WIDGET",
      "label": "{{ appsmith.store.currentTheme === 'light' ? '🌙' : '☀️' }}",
      "onClick": "{{ appsmith.store.setTheme(appsmith.store.currentTheme === 'light' ? 'dark' : 'light') }}",
      "tooltip": "Toggle dark mode"
    }
  ]
}
```

---

## User Customization Settings

### Customization Options

Users can personalize their experience:

```json
{
  "userPreferences": {
    "theme": {
      "mode": "light|dark|auto",
      "customColors": {
        "primary": "#HEX",
        "secondary": "#HEX"
      }
    },
    "layout": {
      "sidebarPosition": "left|right",
      "sidebarCollapsed": true,
      "compactMode": false,
      "showDetailPanels": true
    },
    "dashboard": {
      "defaultView": "grid|list|kanban",
      "refreshInterval": 30000,
      "autoRefresh": true,
      "showNotifications": true
    },
    "display": {
      "density": "comfortable|compact|spacious",
      "animationsEnabled": true,
      "fontSize": "small|normal|large"
    },
    "dataDisplay": {
      "itemsPerPage": 50,
      "sortBy": "created_at",
      "sortOrder": "desc",
      "defaultFilters": {}
    }
  }
}
```

### Settings Panel Component

```json
{
  "widgetName": "UserSettings",
  "type": "MODAL_WIDGET",
  "title": "Customization Settings",
  "children": [
    {
      "widgetName": "SettingsTabs",
      "type": "TAB_WIDGET",
      "tabs": [
        {
          "id": "appearance",
          "label": "Appearance",
          "children": [
            {
              "widgetName": "ThemeSelector",
              "type": "SELECT_WIDGET",
              "label": "Theme",
              "options": [
                { "label": "Light", "value": "light" },
                { "label": "Dark", "value": "dark" },
                { "label": "High Contrast", "value": "high-contrast" },
                { "label": "Auto (System)", "value": "auto" }
              ],
              "value": "{{ appsmith.user.preferences.theme.mode }}"
            },
            {
              "widgetName": "DensitySelector",
              "type": "SELECT_WIDGET",
              "label": "Display Density",
              "options": [
                { "label": "Comfortable", "value": "comfortable" },
                { "label": "Compact", "value": "compact" },
                { "label": "Spacious", "value": "spacious" }
              ],
              "value": "{{ appsmith.user.preferences.display.density }}"
            },
            {
              "widgetName": "FontSizeSelector",
              "type": "SELECT_WIDGET",
              "label": "Font Size",
              "options": [
                { "label": "Small", "value": "small" },
                { "label": "Normal", "value": "normal" },
                { "label": "Large", "value": "large" }
              ],
              "value": "{{ appsmith.user.preferences.display.fontSize }}"
            },
            {
              "widgetName": "AnimationsToggle",
              "type": "CHECKBOX_WIDGET",
              "label": "Enable Animations",
              "value": "{{ appsmith.user.preferences.display.animationsEnabled }}"
            }
          ]
        },
        {
          "id": "layout",
          "label": "Layout",
          "children": [
            {
              "widgetName": "SidebarPositionSelector",
              "type": "SELECT_WIDGET",
              "label": "Sidebar Position",
              "options": [
                { "label": "Left", "value": "left" },
                { "label": "Right", "value": "right" }
              ],
              "value": "{{ appsmith.user.preferences.layout.sidebarPosition }}"
            },
            {
              "widgetName": "CompactModeToggle",
              "type": "CHECKBOX_WIDGET",
              "label": "Compact Mode",
              "value": "{{ appsmith.user.preferences.layout.compactMode }}"
            },
            {
              "widgetName": "DetailPanelsToggle",
              "type": "CHECKBOX_WIDGET",
              "label": "Show Detail Panels",
              "value": "{{ appsmith.user.preferences.layout.showDetailPanels }}"
            }
          ]
        },
        {
          "id": "data",
          "label": "Data Display",
          "children": [
            {
              "widgetName": "ItemsPerPageInput",
              "type": "NUMBER_INPUT",
              "label": "Items Per Page",
              "value": "{{ appsmith.user.preferences.dataDisplay.itemsPerPage }}"
            },
            {
              "widgetName": "AutoRefreshToggle",
              "type": "CHECKBOX_WIDGET",
              "label": "Auto Refresh",
              "value": "{{ appsmith.user.preferences.dashboard.autoRefresh }}"
            },
            {
              "widgetName": "RefreshIntervalInput",
              "type": "NUMBER_INPUT",
              "label": "Refresh Interval (ms)",
              "value": "{{ appsmith.user.preferences.dashboard.refreshInterval }}",
              "disabled": "!{{ autoRefreshToggle.value }}"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Custom Branding

### Logo & Brand Configuration

```json
{
  "branding": {
    "logo": {
      "light": "https://lux.kushnir.cloud/images/logo-light.png",
      "dark": "https://lux.kushnir.cloud/images/logo-dark.png",
      "width": 200,
      "height": 60
    },
    "favicon": "https://lux.kushnir.cloud/images/favicon.ico",
    "title": "Lux-Auto Deal Management",
    "tagline": "Intelligent Vehicle Deal Intelligence",
    "colors": {
      "primary": "#1976D2",
      "accent": "#DC004E"
    }
  }
}
```

### Customization in Appsmith

```javascript
// Load branding configuration
const brandingConfig = {
  siteName: 'Lux-Auto',
  logo: window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'https://lux.kushnir.cloud/images/logo-dark.png'
    : 'https://lux.kushnir.cloud/images/logo-light.png',
  primaryColor: '#1976D2'
};

// Apply branding
document.title = brandingConfig.siteName;
document.querySelector('link[rel="icon"]').href = brandingConfig.favicon;
```

---

## Personalization Features

### Dashboard Customization Widget

Users can personalize their dashboard:

```json
{
  "widgetName": "DashboardCustomizer",
  "type": "CONTAINER_WIDGET",
  "children": [
    {
      "widgetName": "LayoutSelector",
      "type": "SELECT_WIDGET",
      "label": "Dashboard Layout",
      "options": [
        { "label": "Standard Grid", "value": "standard" },
        { "label": "Wide List", "value": "wide-list" },
        { "label": "Compact Cards", "value": "compact" },
        { "label": "Timeline View", "value": "timeline" }
      ],
      "value": "{{ appsmith.user.preferences.dashboard.defaultView }}"
    },
    {
      "widgetName": "ChartTypeSelector",
      "type": "SELECT_WIDGET",
      "label": "Chart Display",
      "options": [
        { "label": "Bar Chart", "value": "bar" },
        { "label": "Line Chart", "value": "line" },
        { "label": "Area Chart", "value": "area" },
        { "label": "Table", "value": "table" }
      ]
    },
    {
      "widgetName": "ColumnVisibilitySelector",
      "type": "MULTISELECT_WIDGET",
      "label": "Visible Columns",
      "options": [
        { "label": "ID", "value": "id" },
        { "label": "Status", "value": "status" },
        { "label": "Margin %", "value": "margin" },
        { "label": "Created Date", "value": "created_at" },
        { "label": "Owner", "value": "owner" },
        { "label": "Notes", "value": "notes" }
      ],
      "value": "{{ appsmith.user.preferences.dataDisplay.visibleColumns }}"
    }
  ]
}
```

---

## Accessibility Features

### Accessibility Configuration

```json
{
  "accessibility": {
    "keyboardNavigation": true,
    "screenReaderOptimized": true,
    "highContrast": false,
    "fontSize": "normal",
    "reducedMotion": false,
    "focusIndicators": {
      "visible": true,
      "color": "#0066CC",
      "width": "3px"
    },
    "aria": {
      "enableAriaLive": true,
      "announceTableUpdates": true,
      "announceErrors": true
    }
  }
}
```

### WCAG 2.1 Compliance

- **Color Contrast**: Minimum 4.5:1 for text
- **Focus Management**: Clear focus indicators
- **Keyboard Access**: Tab navigation works
- **Screen Reader**: ARIA labels and descriptions
- **Motion**: Reduce motion respected
- **Sizing**: Touch targets minimum 48x48px

---

## Export & Import User Preferences

### Export Settings

```javascript
// Allow users to export their settings
function exportPreferences() {
  const preferences = appsmith.user.preferences;
  const dataStr = JSON.stringify(preferences, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lux-auto-preferences.json';
  link.click();
}
```

### Import Settings

```javascript
// Import previously exported settings
function importPreferences(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const preferences = JSON.parse(e.target.result);
    appsmith.setUserPreferences(preferences);
  };
  reader.readAsText(file);
}
```

---

## Cloud Sync

### Sync Across Devices

User preferences are stored in the database and synced:

```json
{
  "preferencesSyncAPI": {
    "endpoint": "/api/v2/user/preferences",
    "method": "PUT",
    "body": {
      "theme": "{{ appsmith.user.preferences.theme }}",
      "layout": "{{ appsmith.user.preferences.layout }}",
      "dashboard": "{{ appsmith.user.preferences.dashboard }}"
    },
    "headers": {
      "Authorization": "Bearer {{ appsmith.user.authToken }}"
    }
  }
}
```

---

## Performance Optimizations

### Lazy Loading Themes

```javascript
// Load theme CSS only when needed
function loadTheme(themeName) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/theme-${themeName}.css`;
  document.head.appendChild(link);
}

// Preload light theme (most common)
loadTheme('light');
```

### CSS Variables for Dynamic Theming

```css
:root[data-theme="light"] {
  --color-primary: #1976D2;
  --color-background: #FFFFFF;
  --color-surface: #F5F5F5;
  --color-text: #1A1A1A;
}

:root[data-theme="dark"] {
  --color-primary: #64B5F6;
  --color-background: #121212;
  --color-surface: #1E1E1E;
  --color-text: #FFFFFF;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
}
```

---

## Testing Customizations

### Theme Testing Checklist

- [ ] Light mode renders correctly
- [ ] Dark mode renders correctly
- [ ] High contrast accessible
- [ ] Font sizes readable
- [ ] Colors have sufficient contrast
- [ ] Animations smooth (or disabled)
- [ ] Transitions performant
- [ ] Mobile responsive
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

### User Testing

1. Test with real users across roles
2. Gather feedback on defaults
3. Monitor usage patterns
4. Iterate based on feedback
5. Document popular configurations

---

## Configuration Management

### Store Preferences

Preferences are stored in the database:

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY,
    preferences JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for fast lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

### Default Preferences

```json
{
  "theme": {
    "mode": "light",
    "customColors": null
  },
  "layout": {
    "sidebarPosition": "left",
    "sidebarCollapsed": false,
    "compactMode": false,
    "showDetailPanels": true
  },
  "dashboard": {
    "defaultView": "grid",
    "refreshInterval": 30000,
    "autoRefresh": false,
    "showNotifications": true
  },
  "display": {
    "density": "comfortable",
    "animationsEnabled": true,
    "fontSize": "normal"
  },
  "dataDisplay": {
    "itemsPerPage": 50,
    "sortBy": "created_at",
    "sortOrder": "desc",
    "defaultFilters": {}
  }
}
```

---

Last Updated: April 12, 2026
Version: 1.0
