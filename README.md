# Auto Secure CI/CD Generator

A production-ready SaaS platform that automatically generates secure, DevSecOps-ready CI/CD pipelines for GitHub repositories.

## Features

### Core Functionality
- **GitHub OAuth Integration** - Seamlessly connect your GitHub account
- **Smart Stack Detection** - Automatically detects your tech stack (Node.js, Python, Java, Go, Rust, PHP)
- **Secure Pipeline Generation** - Generates GitHub Actions workflows with built-in security features
- **Multiple Pipeline Templates**
  - **Basic** - Simple CI with build and test
  - **Advanced** - Includes linting, testing, and Docker
  - **Secure** - Full DevSecOps with security scanning

### Security Features
- **SAST** (Static Application Security Testing)
- **DAST** (Dynamic Application Security Testing)
- **Secrets Scanning** - Detect exposed API keys and credentials
- **Dependency Scanning** - Identify vulnerable packages
- **Security Dashboard** - Real-time vulnerability tracking

### Additional Features
- **CI/CD Analyzer** - Analyze and fix existing pipelines
- **Push to GitHub** - Automatically commit generated pipelines
- **Security Scoring** - Get security scores for your pipelines
- **Best Practices** - Industry-standard DevSecOps patterns

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Lucide React for icons
- Vite for build tooling

### Backend
- Node.js with Express
- Clean architecture (controllers, services, utilities)
- RESTful API design

### Database
- PostgreSQL via Supabase
- Row Level Security (RLS) enabled
- Automatic migrations

### DevOps
- Docker & Docker Compose
- Nginx for frontend serving
- Multi-stage builds

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (optional)
- GitHub account
- Supabase account

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd auto-secure-cicd-generator
```

### 2. GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - Application name: `Auto Secure CI/CD Generator`
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173`
4. Save your Client ID and Client Secret

### 3. Supabase Setup

The database is already provisioned and configured. The Supabase environment variables are available in your environment.

### 4. Environment Configuration

#### Frontend (.env)

```bash
cp .env.example .env
```

Edit `.env` and add:

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_URL=http://localhost:3001
VITE_GITHUB_CLIENT_ID=<your-github-client-id>
VITE_GITHUB_REDIRECT_URI=http://localhost:5173
```

#### Backend (backend/.env)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

### 5. Install Dependencies

#### Frontend
```bash
npm install
```

#### Backend
```bash
cd backend
npm install
```

### 6. Run the Application

#### Option A: Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

#### Option B: Docker

```bash
docker-compose up --build
```

The application will be available at:
- Frontend: http://localhost:80
- Backend API: http://localhost:3001

## Usage Guide

### 1. Login with GitHub

1. Click "Continue with GitHub" on the login page
2. Authorize the application to access your repositories
3. You'll be redirected back to the dashboard

### 2. Sync Repositories

1. Click "Sync Repositories" to load your GitHub repos
2. Your repositories will appear in the dashboard

### 3. Generate a Pipeline

1. Click "Generate Pipeline" on any repository card
2. Select a pipeline type:
   - **Basic** - Simple CI
   - **Advanced** - CI with Docker
   - **Secure** - Full DevSecOps
3. Click "Generate Secure CI/CD Pipeline"
4. Review the generated YAML and security dashboard

### 4. Push to GitHub

1. Review the generated pipeline
2. Click "Push to GitHub"
3. The pipeline will be committed to `.github/workflows/secure-pipeline.yml`

### 5. Analyze Existing Pipelines

1. Go to the "Fix My CI/CD" tab
2. Paste your existing GitHub Actions YAML
3. Click "Analyze Pipeline"
4. Review issues, warnings, and get an optimized version

## API Endpoints

### Authentication
- `POST /api/auth/github/callback` - Handle GitHub OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Repositories
- `GET /api/repos` - Get user repositories
- `POST /api/repos/sync` - Sync GitHub repositories
- `GET /api/repos/:repoId` - Get repository details
- `POST /api/repos/:repoId/detect-stack` - Detect tech stack

### Pipelines
- `POST /api/pipelines/generate` - Generate pipeline
- `GET /api/pipelines/repo/:repoId` - Get pipelines for repo
- `POST /api/pipelines/:pipelineId/push` - Push to GitHub
- `GET /api/pipelines/:pipelineId/security` - Get security dashboard

### Analyzer
- `POST /api/analyzer/analyze` - Analyze YAML

## Architecture

### Backend Structure
```
backend/
├── src/
│   ├── server.js              # Express app setup
│   ├── config/
│   │   └── supabase.js        # Supabase client
│   ├── controllers/           # Request handlers
│   │   ├── auth.controller.js
│   │   ├── repo.controller.js
│   │   ├── pipeline.controller.js
│   │   └── analyzer.controller.js
│   ├── services/              # Business logic
│   │   ├── auth.service.js
│   │   ├── repo.service.js
│   │   ├── pipeline.service.js
│   │   └── analyzer.service.js
│   ├── routes/                # API routes
│   │   ├── auth.routes.js
│   │   ├── repo.routes.js
│   │   ├── pipeline.routes.js
│   │   └── analyzer.routes.js
│   ├── middleware/            # Express middleware
│   │   └── auth.middleware.js
│   └── utils/                 # Utilities
│       ├── stack-detector.js
│       ├── yaml-generator.js
│       └── security-scanner.js
└── package.json
```

### Frontend Structure
```
src/
├── App.tsx                    # Main app component
├── main.tsx                   # Entry point
├── contexts/
│   └── AuthContext.tsx        # Auth state management
├── components/
│   ├── Header.tsx             # App header
│   ├── LoginPage.tsx          # Login page
│   ├── Dashboard.tsx          # Main dashboard
│   ├── RepositoryCard.tsx     # Repo card component
│   ├── PipelineGenerator.tsx  # Pipeline generator
│   └── AnalyzerPage.tsx       # CI/CD analyzer
└── lib/
    ├── supabase.ts            # Supabase client
    └── api.ts                 # API client
```

### Database Schema

#### users
- Stores GitHub user information
- Encrypted access tokens

#### repositories
- Repository metadata
- Detected tech stack (JSONB)

#### pipelines
- Generated pipeline YAML
- Security features enabled
- Status tracking

#### security_scans
- Security scan results
- Vulnerability counts
- Risk levels

## Security Considerations

- OAuth tokens are stored securely in the database
- Row Level Security (RLS) ensures users only access their own data
- Input validation on all endpoints
- CORS configured properly
- Environment variables for sensitive data
- No hardcoded credentials

## Generated Pipeline Features

### Security Scanning
- **SAST** - Detects code vulnerabilities
- **DAST** - Tests running applications
- **Secrets Scanning** - Finds exposed credentials
- **Dependency Scanning** - Identifies vulnerable packages

### DevOps Best Practices
- Automated testing
- Code coverage reporting
- Linting and code quality
- Docker containerization
- Multi-stage builds
- Deployment automation

## Troubleshooting

### Common Issues

**1. GitHub OAuth not working**
- Verify your GitHub OAuth app callback URL matches exactly
- Check Client ID and Secret in .env files
- Ensure you're using the correct redirect URI

**2. Cannot connect to backend**
- Verify backend is running on port 3001
- Check CORS configuration
- Ensure API_URL in frontend .env is correct

**3. Database connection issues**
- Verify Supabase URL and keys
- Check RLS policies are enabled
- Ensure migrations ran successfully

**4. Pipeline push fails**
- Verify GitHub token has repo write permissions
- Check if repository exists and is accessible
- Ensure .github/workflows directory permissions

## Production Deployment

### Frontend
1. Build the production bundle: `npm run build`
2. Deploy `dist/` folder to your hosting provider
3. Configure environment variables

### Backend
1. Set NODE_ENV=production
2. Use a process manager (PM2, systemd)
3. Set up reverse proxy (Nginx, Caddy)
4. Enable HTTPS

### Docker
```bash
docker-compose -f docker-compose.yml up -d
```

## Future Enhancements

- Multi-cloud support (AWS, Azure, GCP)
- GitLab and Bitbucket integration
- CLI tool for local generation
- AI-powered optimization suggestions
- Template marketplace
- Team collaboration features
- Advanced security reporting
- Integration with security tools (SonarQube, Snyk)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the development team

---

Built with ❤️ for DevSecOps engineers and developers who care about security.
