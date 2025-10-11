# GitHub Repository Monitoring Dashboard - Design Document

## Project Overview

A SvelteKit-based Single Page Application (SPA) that monitors GitHub Actions workflows across multiple repositories. The dashboard provides real-time visibility into workflow statuses, helping teams track CI/CD pipeline health across their projects.

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
github-repository-monitoring/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # Main layout
│   │   └── +page.svelte            # Dashboard home page
│   ├── lib/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── RepositoryCard.svelte
│   │   │   ├── WorkflowStatus.svelte
│   │   │   └── RefreshButton.svelte
│   │   ├── services/               # API and business logic
│   │   │   ├── github-api.ts       # GitHub API client
│   │   │   └── config-loader.ts    # YAML configuration loader
│   │   ├── types/                  # TypeScript type definitions
│   │   │   └── github.ts
│   │   └── utils/                  # Utility functions
│   │       └── date-formatter.ts
│   ├── app.html                    # HTML template
│   ├── app.css                     # Global styles
│   └── app.d.ts                    # TypeScript declarations
├── config.yaml                     # Repository configuration
├── package.json
└── README.md
```

## Features

### Core Features (MVP)
1. **Repository Grid View**: Display monitored repositories in a responsive card layout
2. **Workflow Status Indicators**: Show current status of latest workflow runs
3. **Configuration Management**: YAML-based repository configuration
4. **Basic Error Handling**: Display connection and API errors
5. **Responsive Design**: Works on desktop and mobile devices

### Enhanced Features (Future)
1. **Real-time Updates**: Auto-refresh workflow statuses
2. **Detailed Workflow View**: Click to see individual workflow run details
3. **Filtering & Sorting**: Filter by status, sort by last updated
4. **Historical Data**: Show workflow run history and trends
5. **Notifications**: Browser notifications for status changes
6. **GitHub Authentication**: Personal access token integration
7. **Multiple Branch Support**: Monitor different branches per repository

## Component Design

### RepositoryCard Component
```typescript
interface RepositoryCardProps {
  repository: Repository;
  workflowRuns: WorkflowRun[];
  lastUpdated: Date;
}
```

**Features**:
- Repository name and owner
- Current workflow status badge
- Last run timestamp
- Branch information
- Quick actions (refresh, view details)

### WorkflowStatus Component
```typescript
interface WorkflowStatusProps {
  status: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'queued';
  conclusion?: string;
  createdAt: Date;
}
```

**Features**:
- Color-coded status indicators
- Status text and icons
- Timestamp display
- Loading states

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

interface Config {
  repositories: Repository[];
  github: {
    token?: string;
    api_url: string;
  };
  dashboard: {
    refresh_interval: number;
    max_runs_per_repo: number;
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
- **Grid Layout**: Responsive card grid (min 300px per card)
- **Card Design**: Clean, minimal with clear status indicators
- **Loading States**: Skeleton loading for better UX
- **Empty States**: Helpful messages when no data available

### Responsive Breakpoints
- **Mobile**: < 768px (single column)
- **Tablet**: 768px - 1024px (2 columns)
- **Desktop**: > 1024px (3+ columns)

## Development Phases

### Phase 1: Foundation (Current)
- [x] SvelteKit project setup
- [x] Basic dashboard layout
- [x] Mock data display
- [x] YAML configuration structure
- [ ] Configuration loader implementation

### Phase 2: GitHub Integration
- [ ] GitHub API client
- [ ] Real workflow data fetching
- [ ] Error handling implementation
- [ ] Loading states

### Phase 3: Enhanced UX
- [ ] Auto-refresh functionality
- [ ] Detailed workflow views
- [ ] Filtering and sorting
- [ ] Performance optimizations

### Phase 4: Advanced Features
- [ ] GitHub authentication
- [ ] Historical data storage
- [ ] Notifications system
- [ ] Settings page

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

## Future Enhancements

1. **Multi-Branch Monitoring**: Track multiple branches per repository
2. **Workflow Filtering**: Show only specific workflows (e.g., CI, deployment)
3. **Team Management**: User authentication and team-based repository access
4. **Metrics & Analytics**: Workflow success rates, average run times
5. **Slack/Email Integration**: Notifications for workflow status changes
6. **Custom Themes**: Dark mode and customizable color schemes
7. **Export Functionality**: Export status reports to PDF/CSV
8. **Webhook Integration**: Real-time updates via GitHub webhooks

---

*This design document is a living document and will be updated as the project evolves.*