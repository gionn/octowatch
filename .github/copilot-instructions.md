# OctoWatch - Copilot Instructions

## Project Overview

This is a SvelteKit-based GitHub Actions workflow monitoring dashboard that displays the status of GitHub workflows across multiple repositories in a collapsible table format.

## Core Architecture Principles

### Documentation First

- **ALWAYS** update README.md and DESIGN.md when changing architecture or features
- Keep documentation synchronized with code changes
- Update examples in README when adding new features

### Code Organization

- Follow the established SvelteKit project structure
- Keep services in `src/lib/services/`
- Keep types in `src/lib/types/`
- Keep utilities in `src/lib/utils/`
- Main dashboard logic stays in `src/routes/+page.svelte`

### Data Flow & State Management

- Configuration loaded from `static/config.yaml` via `config-loader.ts`
- GitHub tokens managed via `token-storage.ts` (localStorage persistence)
- API calls handled by `github-api.ts` service
- Repository expansion state managed in main component
- Auto-refresh implemented with configurable intervals

## Key Features & Implementation Guidelines

### GitHub API Integration

- Use the `GitHubApiClient` class for all GitHub API interactions
- Support dynamic token updates via `updateToken()` method
- Implement workflow deduplication (latest run per unique workflow name)
- Handle rate limiting gracefully with informative error messages
- Support both authenticated and unauthenticated requests

### UI/UX Standards

- Maintain responsive design for mobile and desktop
- Use collapsible table layout for repository organization
- Implement visual status indicators with color coding:
  - Green: Success
  - Red: Failure
  - Blue: In Progress
  - Gray: Cancelled/Unknown
- Provide cumulative status summaries for collapsed repositories
- Include hover effects and smooth animations

### Token Management

- Never store tokens in configuration files
- Use `TokenStorage` service for localStorage persistence
- Implement token validation for various GitHub token formats
- Provide user-friendly token management UI with gear icon
- Show visual token status indicators (green=configured, red=missing)

### Error Handling

- Implement graceful error handling for network issues
- Provide user-friendly error messages
- Handle GitHub API rate limits appropriately
- Show loading states during API calls
- Support retry mechanisms where appropriate

## Development Best Practices

### TypeScript

- Maintain strict type safety
- Use proper interfaces for all data structures
- Handle union types correctly (especially in Svelte templates)
- Avoid `any` types - use proper type assertions when needed

### Accessibility

- Include proper ARIA attributes for interactive elements
- Support keyboard navigation (ESC key for modals)
- Use semantic HTML elements
- Provide proper focus management

### Performance

- Implement efficient data fetching strategies
- Use proper caching mechanisms (config caching)
- Minimize API calls through deduplication
- Implement background refresh without blocking UI

### Configuration

- Keep configuration in YAML format for readability
- Support hot-reloading of configuration changes
- Provide reasonable defaults for all settings
- Validate configuration on load

## Code Style Guidelines

### SvelteKit Specific

- Use reactive statements (`$:`) for derived state
- Implement proper component lifecycle with onMount/onDestroy
- Handle SSR compatibility (especially for localStorage access)
- Use proper event handling with `on:click` and keyboard events

### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use kebab-case for file names
- Use descriptive names that reflect functionality

### File Organization

- Group related functionality in services
- Keep components focused and single-purpose
- Separate business logic from presentation logic
- Use barrel exports where appropriate

## Security Considerations

- Never expose GitHub tokens in client-side code beyond localStorage
- Validate all user inputs (especially tokens)
- Implement proper CORS handling
- Use secure token storage practices

## Testing & Quality

- Ensure TypeScript compilation passes without errors
- Test responsive design across different screen sizes
- Validate accessibility compliance
- Test token management functionality thoroughly
- Verify error handling scenarios

## Common Patterns in This Project

### Configuration Loading

```typescript
const config = await loadConfig();
const token = TokenStorage.getToken();
const apiClient = new GitHubApiClient(config.github.api_url, token);
```

### Repository Status Management

```typescript
const repositoryStatuses = await apiClient.getAllRepositoryStatuses(
  config.repositories,
  config.dashboard.max_runs_to_fetch,
);
```

### Token Management

```typescript
TokenStorage.setToken(newToken);
apiClient.updateToken(newToken);
```

## When Making Changes

1. **Always** read existing code patterns first
2. Update documentation (README.md, DESIGN.md) for architectural changes
3. Maintain backward compatibility where possible
4. Test token management flows after auth-related changes
5. Verify responsive design after UI changes
6. Run TypeScript checks to ensure type safety
7. Test error scenarios and edge cases

## Project-Specific Notes

- This project uses workflow deduplication (latest run per workflow name)
- Auto-refresh is configurable and runs in the background
- The main dashboard is a single-file component by design
- Token management uses localStorage for persistence
- Configuration watching enables hot-reload of settings
