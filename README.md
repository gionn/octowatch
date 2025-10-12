# GitHub Repository Monitoring Dashboard

A modern SvelteKit-based Single Page Application (SPA) that monitors GitHub Actions workflows across multiple repositories. Built with TypeScript and designed to provide real-time visibility into your CI/CD pipeline health.

## Features

- 🔍 **Multi-Repository Monitoring**: Track GitHub Actions workflows across multiple repositories
- � **Repository Groups**: Organize repositories into logical groups for better management
- �📊 **Collapsible Table View**: Compact repository summary with expandable workflow details
- 🎯 **Cumulative Status**: Smart status aggregation showing worst-case status per repository
- 📈 **Real-time Updates**: Automatic refresh with configurable intervals and config file watching
- 🎨 **Clean UI**: Modern, responsive design with color-coded status indicators
- ⚙️ **YAML Configuration**: Simple configuration management via `static/config.yaml`
- 🤖 **Dependabot Filtering**: Option to hide Dependabot-triggered workflows from the dashboard
- 🔐 **Token Management**: Secure GitHub token storage with validation and rate limit improvements
- 🚀 **Fast Performance**: Built with SvelteKit and Vite for optimal performance
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Quick Start

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- GitHub repositories with Actions workflows

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd github-repository-monitoring
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure repository groups**:
   Edit `static/config.yaml` to add your repository groups:

   ```yaml
   repository_groups:
     - name: "Frontend Projects"
       slug: "frontend"
       description: "All frontend applications and libraries"
       enabled: true
       repositories:
         - name: "your-repo-name"
           owner: "your-github-username"
           url: "https://github.com/your-username/your-repo-name"
           branch: "main"
           enabled: true
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:5173`

## Configuration

### Basic Configuration

Edit the `static/config.yaml` file to customize your monitoring setup:

```yaml
# Repository groups for better organization
repository_groups:
  - name: "Backend Services"
    slug: "backend"
    description: "Core API and microservices"
    enabled: true
    repositories:
      - name: "api-service"
        owner: "mycompany"
        url: "https://github.com/mycompany/api-service"
        branch: "main"
        enabled: true

      - name: "auth-service"
        owner: "mycompany"
        url: "https://github.com/mycompany/auth-service"
        branch: "main"
        enabled: true

  - name: "Frontend Applications"
    slug: "frontend"
    description: "Web applications and UI libraries"
    enabled: true
    repositories:
      - name: "web-app"
        owner: "mycompany"
        url: "https://github.com/mycompany/web-app"
        branch: "develop"
        enabled: true

# GitHub API settings
github:
  api_url: "https://api.github.com"

# Dashboard settings
dashboard:
  refresh_interval: 30              # Auto-refresh interval in seconds
  max_runs_to_fetch: 20            # Max workflow runs to fetch per repo
  show_statuses: ["success", "failure", "in_progress"]
```

**Navigation:**
- The home page shows all repository groups as cards
- Click "Monitor Workflows →" on any group card to view its repositories
- Use the breadcrumb navigation to return to the groups overview

### GitHub Personal Access Token (Recommended)

For better rate limits and private repository access:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with appropriate scopes:
   - **Classic tokens**: `repo` and `actions:read` scopes
   - **Fine-grained tokens**: "Actions" read-only access
3. Click the gear icon in the dashboard to open Settings
4. Enter your token and configure other preferences (like Dependabot filtering)
5. **Never commit tokens to your repository!**

**Supported Token Formats:**

- Classic tokens (40-character hex strings)
- Fine-grained personal access tokens (`ghp_...`)
- New GitHub PAT format (`github_pat_...`)
- OAuth and server tokens (`gho_`, `ghu_`, `ghs_`, `ghr_`)

### Settings & Preferences

The dashboard includes a settings panel (gear icon) where you can:

- **GitHub Token**: Enter your personal access token for higher rate limits
- **Dependabot Filtering**: Choose to hide workflows triggered by Dependabot
- Settings are automatically saved to localStorage and persist across sessions

### Environment Variables

You can also use environment variables:

```bash
export GITHUB_TOKEN=your_github_token_here
npm run dev
```

## Repository Configuration Options

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Repository name | ✅ |
| `owner` | GitHub username/organization | ✅ |
| `url` | Full GitHub repository URL | ✅ |
| `branch` | Branch to monitor (default: main) | ✅ |
| `enabled` | Whether to monitor this repo | ✅ |

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run check` - Run TypeScript and Svelte checks
- `npm run lint` - Check code formatting
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── routes/
│   ├── +layout.svelte          # Main application layout
│   └── +page.svelte            # Dashboard home page
├── lib/
│   ├── components/             # Reusable UI components
│   │   └── RefreshButton.svelte
│   ├── services/               # API and business logic
│   │   ├── github-api.ts       # GitHub API integration
│   │   ├── config-loader.ts    # Configuration management
│   │   └── token-storage.ts    # Token and settings storage
│   ├── types/                  # TypeScript definitions
│   │   └── github.ts
│   └── utils/                  # Utility functions
│       └── date-formatter.ts
├── app.html                    # HTML template
├── app.css                     # Global styles
└── app.d.ts                   # TypeScript declarations
```

## Dashboard Layout

### Collapsible Repository View

The dashboard displays repositories in a **collapsible table format**:

**📋 Repository Summary (Collapsed by default):**
- **▶/▼ Toggle**: Click to expand/collapse workflow details
- **Repository Name**: Clickable link to GitHub repository
- **Branch**: Monitored branch name
- **Cumulative Status**: Aggregated status across all workflows
- **Workflow Summary**: Count of passed/failed/running workflows
- **Last Activity**: Most recent workflow run timestamp
- **View All**: Link to repository's GitHub Actions page

**🔍 Expanded Details (Click to show):**
- Individual workflow runs with full information
- Workflow name, specific status, commit SHA, timing
- Direct links to individual workflow run pages

### Status Colors & Priority

The dashboard uses color coding with **smart status aggregation**:

- 🔴 **Red (Failure)**: At least one workflow failed (highest priority)
- 🟡 **Yellow (In Progress)**: Workflows currently running (if no failures)
- 🟢 **Green (Success)**: All workflows passed successfully
- ⚫ **Gray (Cancelled)**: Workflows were cancelled
- 🔵 **Blue (Unknown)**: Status couldn't be determined

**Status Priority**: Failure > In Progress > Success > Cancelled > Unknown

## Troubleshooting

### Common Issues

**"Repository not found" errors**:
- Verify repository names and owners in `config.yaml`
- Check if repositories are public or if you have access
- Ensure your GitHub token has appropriate permissions

**Rate limit exceeded**:
- Add a GitHub personal access token to `config.yaml`
- Reduce the number of monitored repositories
- Increase the refresh interval

**Configuration errors**:
- Validate your YAML syntax
- Ensure all required fields are present
- Check the browser console for detailed error messages

**Dependabot workflows still showing**:
- Open Settings (gear icon) and enable "Ignore Dependabot workflows"
- Settings are saved automatically and take effect immediately
- This filters workflows where the actor is "dependabot[bot]"

### API Rate Limits

- **Without token**: 60 requests/hour per IP
- **With token**: 5,000 requests/hour per token
- **Recommendation**: Always use a personal access token for production

## Development

### Current Architecture

The dashboard uses a **single-page table layout** with collapsible rows:

- **Main View**: `src/routes/+page.svelte` - Contains the entire dashboard logic
- **Components**: `src/lib/components/RefreshButton.svelte` - Manual refresh functionality
- **Services**: GitHub API integration and configuration loading
- **Real-time Features**: Auto-refresh and config file watching

### Adding New Features

1. **UI Updates**: Modify the main table in `src/routes/+page.svelte`
2. **API Integration**: Extend services in `src/lib/services/`
3. **Configuration**: Add new options to `static/config.yaml`
4. **Types**: Define TypeScript interfaces in `src/lib/types/`
5. **Utilities**: Add helper functions in `src/lib/utils/`

### Building for Production

```bash
npm run build
```

The built application will be in the `build/` directory, ready for deployment to any static hosting service.

### Deployment Options

- **Vercel**: Connect your GitHub repo for automatic deployments
- **Netlify**: Drag and drop the `build/` folder
- **GitHub Pages**: Use GitHub Actions for automated deployment
- **Any static host**: Upload the contents of `build/`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push to your fork and create a pull request

## License

This project is open source. See the design document (`DESIGN.md`) for architectural details and future roadmap.

## Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Review the `DESIGN.md` file for architectural details
3. Open an issue on GitHub with detailed information

---

**Built with ❤️ using SvelteKit and TypeScript**
