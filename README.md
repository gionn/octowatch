# GitHub Repository Monitoring Dashboard

A modern SvelteKit-based Single Page Application (SPA) that monitors GitHub Actions workflows across multiple repositories. Built with TypeScript and designed to provide real-time visibility into your CI/CD pipeline health.

## Features

- 🔍 **Multi-Repository Monitoring**: Track GitHub Actions workflows across multiple repositories
- 📊 **Real-time Status Updates**: See current workflow statuses with automatic refresh
- 🎨 **Clean UI**: Modern, responsive dashboard with status-color coding
- ⚙️ **YAML Configuration**: Simple configuration management via `config.yaml`
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

3. **Configure repositories**:
   Edit `static/config.yaml` to add your repositories:
   ```yaml
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
# List of repositories to monitor
repositories:
  - name: "my-awesome-app"
    owner: "mycompany"
    url: "https://github.com/mycompany/my-awesome-app"
    branch: "main"
    enabled: true

  - name: "api-service"
    owner: "mycompany"
    url: "https://github.com/mycompany/api-service"
    branch: "develop"
    enabled: true

# GitHub API settings
github:
  # Optional: Add your GitHub personal access token for higher rate limits
  token: ""
  api_url: "https://api.github.com"

# Dashboard settings
dashboard:
  refresh_interval: 30        # Auto-refresh interval in seconds
  max_runs_per_repo: 5       # Max workflow runs to display per repo
  show_statuses: ["success", "failure", "in_progress"]
```

### GitHub Personal Access Token (Recommended)

For better rate limits and private repository access:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` and `actions:read` scopes
2. Add the token to your `static/config.yaml` or set the `GITHUB_TOKEN` environment variable
4. **Never commit tokens to your repository!**

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
│   │   └── config-loader.ts    # Configuration management
│   ├── types/                  # TypeScript definitions
│   │   └── github.ts
│   └── utils/                  # Utility functions
│       └── date-formatter.ts
├── app.html                    # HTML template
├── app.css                     # Global styles
└── app.d.ts                   # TypeScript declarations
```

## Workflow Status Colors

The dashboard uses color coding to quickly identify workflow statuses:

- 🟢 **Green**: Success - All workflows passed
- 🔴 **Red**: Failure - One or more workflows failed
- 🟡 **Yellow**: In Progress - Workflows currently running
- ⚫ **Gray**: Cancelled - Workflows were cancelled
- 🔵 **Blue**: Unknown - Status couldn't be determined

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

### API Rate Limits

- **Without token**: 60 requests/hour per IP
- **With token**: 5,000 requests/hour per token
- **Recommendation**: Always use a personal access token for production

## Development

### Adding New Features

1. **Components**: Add reusable UI components in `src/lib/components/`
2. **Services**: Add business logic in `src/lib/services/`
3. **Types**: Define TypeScript interfaces in `src/lib/types/`
4. **Utilities**: Add helper functions in `src/lib/utils/`

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
