# OctoWatch - Design Document

## Project Overview

A SvelteKit-based Single Page Application (SPA) that monitors GitHub Actions workflows across multiple repositories organized into groups. The dashboard provides real-time visibility into workflow statuses, helping teams track CI/CD pipeline health across their projects with improved organization and navigation.

## Architecture

### Technology Stack

- **Frontend Framework**: SvelteKit with TypeScript
- **Styling**: Plain CSS with responsive design
- **Configuration**: YAML-based static configuration
- **API Integration**: GitHub REST API v4
- **Build Tool**: Vite
- **Package Manager**: npm

### Project Structure

```
octowatch/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte                    # Main layout
│   │   ├── +page.svelte                      # Groups overview page
│   │   └── groups/
│   │       └── [slug]/
│   │           └── +page.svelte              # Individual group monitoring
│   ├── lib/
│   │   ├── components/                       # Reusable UI components
│   │   │   ├── RefreshButton.svelte          # Legacy refresh component
│   │   │   └── HeaderActions.svelte          # Coordinated refresh & settings buttons
│   │   ├── services/                         # API and business logic
│   │   │   ├── github-api.ts                 # GitHub API client
│   │   │   ├── config-loader.ts              # YAML configuration loader with groups
│   │   │   └── token-storage.ts              # Token and user settings storage
│   │   ├── types/                            # TypeScript type definitions
│   │   │   └── github.ts                     # Repository and RepositoryGroup interfaces
│   │   └── utils/                            # Utility functions
│   │       └── date-formatter.ts
│   ├── app.html                              # HTML template
│   ├── app.css                               # Global styles
│   └── app.d.ts                              # TypeScript declarations
├── static/
│   └── config.yaml                           # Repository groups configuration
├── package.json
└── README.md
```

## Features

### Core Features (Implemented)

1. **Repository Groups**: Organize repositories into logical groups for better management
2. **Multi-Page Navigation**: Home page shows groups, dedicated pages for each group
3. **Collapsible Table View**: Display repositories with expandable workflow details
4. **Cumulative Status Aggregation**: Smart status rollup showing worst-case per repository
5. **Real-time Auto-refresh**: Configurable intervals with config file watching
6. **Configuration Management**: YAML-based repository groups configuration with hot-reload
7. **Responsive Design**: Card-based groups overview and table layout with mobile support
8. **Error Handling**: Comprehensive error display and graceful degradation
9. **Dependabot Filtering**: User setting to hide workflows triggered by Dependabot
10. **Settings Management**: Persistent localStorage-based settings with intuitive UI

### Navigation Structure

- **Home Page (/)**: Displays all repository groups as cards with descriptions and repository counts
- **Group Pages (/groups/[slug])**: Individual group monitoring with collapsible table view
- **Breadcrumb Navigation**: Easy navigation between groups overview and specific groups

### Enhanced Features (Future)

1. **Detailed Workflow View**: Click to see individual workflow run details
2. **Filtering & Sorting**: Filter by status, sort by last updated
3. **Historical Data**: Show workflow run history and trends
4. **Notifications**: Browser notifications for status changes
5. **Multiple Branch Support**: Monitor different branches per repository
6. **Group-level Status**: Aggregate status indicators across entire groups

## Architecture Design

### Single-Page Table Layout

The dashboard uses a **unified table approach** with collapsible functionality:

**Main Component**: `src/routes/+page.svelte`

- Complete dashboard logic in single file
- Repository summary rows (collapsed by default)
- Expandable workflow detail rows
- Real-time updates and configuration watching

**Supporting Components**:

- `HeaderActions.svelte` - Reusable coordinated refresh and settings buttons
- `RefreshButton.svelte` - Legacy refresh component (deprecated)
- Configuration and API services in `src/lib/services/`

### Collapsible Repository View

**Repository Summary Row**:

```typescript
interface RepositorySummary {
  repository: Repository;
  cumulativeStatus: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'unknown';
  statusText: string; // e.g., "2 failed, 3 passed"
  runCount: number;
  lastActivity: Date;
  isExpanded: boolean;
}
```

**Workflow Detail Row** (shown when expanded):

```typescript
interface WorkflowDetail {
  workflowRun: WorkflowRun;
  indentLevel: number;
  parentRepository: Repository;
}
```

### Status Aggregation Logic

**Cumulative Status Priority**:

1. **Failure** (highest) - Any workflow failed
2. **In Progress** - Workflows running (if no failures)
3. **Success** - All workflows passed
4. **Cancelled** - All workflows cancelled
5. **Unknown** (lowest) - Indeterminate state

## Data Models

### Repository Configuration

```typescript
interface Repository {
  name: string;
  owner: string;
  url: string;
  branch: string;
  enabled: boolean;
}

interface RepositoryGroup {
  name: string;
  slug: string;
  description: string;
  enabled: boolean;
  repositories: Repository[];
}

interface Config {
  repository_groups?: RepositoryGroup[];
  repositories?: Repository[]; // Legacy support
  github: {
    api_url: string;
  };
  dashboard: {
    refresh_interval: number;
    max_runs_to_fetch: number;
    show_statuses: string[];
  };
}
```

### GitHub API Response Types

```typescript
interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_branch: string;
  head_sha: string;
  actor: {
    login: string;
  };
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string;
}
```

## API Integration

### GitHub REST API Endpoints

- `GET /repos/{owner}/{repo}/actions/runs` - List workflow runs
- `GET /repos/{owner}/{repo}` - Get repository information
- `GET /repos/{owner}/{repo}/actions/workflows` - List workflows

### Rate Limiting

- **Unauthenticated**: 60 requests per hour per IP
- **Authenticated**: 5,000 requests per hour per token
- **Recommendation**: Use personal access token for production

### Error Handling Strategy

1. **Network Errors**: Show connection error message with retry option
2. **API Rate Limiting**: Display rate limit status and reset time
3. **Authentication Errors**: Guide user to configure access token
4. **Repository Not Found**: Mark repository as invalid in UI
5. **Configuration Errors**: Validate YAML and show parsing errors

## UI/UX Design

### Color Scheme

- **Success**: #28a745 (green)
- **Failure**: #d73a49 (red)
- **In Progress**: #ffc107 (yellow)
- **Cancelled**: #6c757d (gray)
- **Background**: #f6f8fa (light gray)
- **Cards**: #ffffff (white)
- **Text**: #24292e (dark gray)

### Layout

- **Header**: Application title and description
- **Controls**: Refresh button with auto-refresh status indicator
- **Table Layout**: Collapsible table with repository summary rows
- **Expandable Details**: Click to reveal individual workflow runs
- **Loading States**: Progressive loading with existing data preserved
- **Empty States**: Helpful messages when no data available

### Responsive Design

- **Desktop**: Full table with all columns visible
- **Tablet/Mobile**: Horizontal scroll with minimum table width
- **Touch-friendly**: Large click targets for expand/collapse buttons
- **Compact**: Reduced padding and font sizes on smaller screens

## Development Phases

### Phase 1: Foundation ✅ **COMPLETED**

- [x] SvelteKit project setup with TypeScript
- [x] Collapsible table layout implementation
- [x] Real GitHub API integration
- [x] YAML configuration with hot-reload
- [x] Cumulative status aggregation logic

### Phase 2: Core Features ✅ **COMPLETED**

- [x] GitHub API client with error handling
- [x] Real workflow data fetching and display
- [x] Auto-refresh functionality with configurable intervals
- [x] Configuration file watching and auto-reload
- [x] Responsive design with mobile support

### Phase 3: Enhanced UX ✅ **COMPLETED**

- [x] Collapsible repository view
- [x] Smart status priority aggregation
- [x] Loading states with existing data preservation
- [x] Comprehensive error handling and display
- [x] Real-time config changes without restart

### Phase 4: Settings & Filtering ✅ **COMPLETED**

- [x] GitHub token management with secure localStorage storage
- [x] Token validation and format checking (supports all GitHub token formats)
- [x] Settings popup with intuitive UI
- [x] Dependabot workflow filtering capability
- [x] Persistent user preferences across sessions
- [x] Reusable HeaderActions component with coordinated refresh and settings buttons

### Phase 5: Future Enhancements

- [ ] Multi-branch monitoring per repository
- [ ] Workflow run history and trends
- [ ] Browser notifications for status changes
- [ ] GitHub authentication for private repos
- [ ] Filtering and sorting capabilities
- [ ] Custom dashboard themes

## Configuration Examples

### Basic Setup

```yaml
repositories:
  - name: "my-app"
    owner: "mycompany"
    url: "https://github.com/mycompany/my-app"
    branch: "main"
    enabled: true
```

### Multiple Repositories

```yaml
repositories:
  - name: "frontend"
    owner: "mycompany"
    branch: "main"
    enabled: true
  - name: "backend"
    owner: "mycompany"
    branch: "develop"
    enabled: true
  - name: "mobile-app"
    owner: "mycompany"
    branch: "main"
    enabled: false
```

## Deployment Considerations

### Static Hosting

- Compatible with Vercel, Netlify, GitHub Pages
- Requires CORS configuration for GitHub API calls
- Environment variables for GitHub tokens

### Security

- Never commit GitHub tokens to repository
- Use environment variables for sensitive data
- Implement proper CORS policies
- Consider using GitHub Apps for enhanced security
- Client-side token storage uses browser localStorage (secure for SPA)
- Token validation prevents invalid formats from being stored
- **Supported Token Formats**:
  - Classic tokens (40-character hexadecimal strings)
  - Fine-grained personal access tokens (`ghp_...`)
  - New GitHub PAT format (`github_pat_...`)
  - OAuth tokens (`gho_...`)
  - User-to-server tokens (`ghu_...`)
  - Server-to-server tokens (`ghs_...`)
  - Refresh tokens (`ghr_...`)

## Future Enhancements

1. **Multi-Branch Monitoring**: Track multiple branches per repository
2. **Workflow Filtering**: Show only specific workflows (e.g., CI, deployment)
3. **Team Management**: User authentication and team-based repository access
4. **Metrics & Analytics**: Workflow success rates, average run times
5. **Slack/Email Integration**: Notifications for workflow status changes
6. **Custom Themes**: Dark mode and customizable color schemes
7. **Export Functionality**: Export status reports to PDF/CSV
8. **Webhook Integration**: Real-time updates via GitHub webhooks

## Current Implementation Status

### ✅ **Fully Implemented Features**

1. **Collapsible Table Interface**: Single-page dashboard with expandable repository rows
2. **Smart Status Aggregation**: Failure > In Progress > Success priority system
3. **Real-time Updates**: Configurable auto-refresh (default 30s) + config file watching (5s)
4. **GitHub API Integration**: Full workflow run fetching with comprehensive error handling
5. **Configuration Management**: `static/config.yaml` with hot-reload capability
6. **Responsive Design**: Mobile-friendly with horizontal scroll and touch-optimized controls
7. **Error Handling**: Network errors, API rate limits, repository access issues
8. **TypeScript**: Full type safety across the application
9. **Settings Management**: Secure token storage and user preferences in localStorage
10. **Enhanced Token Validation**: Support for all GitHub token formats (classic, ghp_, github_pat_, etc.)
11. **Reusable Components**: HeaderActions component with coordinated refresh and settings buttons
12. **Dependabot Filtering**: Option to hide workflows triggered by Dependabot (actor-based filtering)

### 🎯 **Key Architectural Decisions**

- **Single Page Application**: All logic in `src/routes/+page.svelte` for simplicity
- **Static Configuration**: Config in `static/config.yaml` served by SvelteKit automatically
- **No Backend Required**: Pure frontend solution using GitHub's public API
- **Progressive Enhancement**: Works without JavaScript for basic HTML table
- **Minimal Dependencies**: Only essential packages (SvelteKit, TypeScript, js-yaml)
- **Client-side Settings**: User preferences stored securely in localStorage
- **Actor-based Filtering**: Workflow filtering based on GitHub actor information
- **Component Architecture**: Reusable HeaderActions component eliminates code duplication

### 📊 **Performance Characteristics**

- **Initial Load**: ~1-2s for 5-10 repositories
- **Auto-refresh**: Background updates without UI blocking
- **Config Changes**: 5-second detection cycle for development
- **Memory Usage**: Minimal state management, efficient re-rendering
- **Bundle Size**: Optimized for fast loading with SvelteKit

---

*This design document reflects the current implementation as of October 2025.*
