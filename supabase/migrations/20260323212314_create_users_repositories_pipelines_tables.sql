/*
  # Auto Secure CI/CD Generator - Database Schema

  ## Overview
  Creates the core database schema for the DevSecOps SaaS platform that allows users
  to generate secure CI/CD pipelines for their GitHub repositories.

  ## New Tables
  
  ### 1. `users`
  Stores authenticated GitHub users
  - `id` (uuid, primary key): Unique user identifier
  - `github_id` (bigint, unique): GitHub user ID
  - `username` (text): GitHub username
  - `email` (text): User email
  - `avatar_url` (text): GitHub avatar URL
  - `access_token` (text): Encrypted GitHub access token
  - `created_at` (timestamptz): Account creation timestamp
  - `updated_at` (timestamptz): Last update timestamp

  ### 2. `repositories`
  Stores repository information for each user
  - `id` (uuid, primary key): Unique repository identifier
  - `user_id` (uuid, foreign key): Owner of the repository
  - `github_repo_id` (bigint): GitHub repository ID
  - `repo_name` (text): Repository name
  - `repo_full_name` (text): Full repository name (owner/repo)
  - `repo_url` (text): Repository URL
  - `default_branch` (text): Default branch name
  - `is_private` (boolean): Whether repository is private
  - `stack_detected` (jsonb): Detected technology stack
  - `created_at` (timestamptz): Record creation timestamp
  - `updated_at` (timestamptz): Last update timestamp

  ### 3. `pipelines`
  Stores generated CI/CD pipelines
  - `id` (uuid, primary key): Unique pipeline identifier
  - `repo_id` (uuid, foreign key): Associated repository
  - `user_id` (uuid, foreign key): Pipeline creator
  - `pipeline_type` (text): Type of pipeline (basic, advanced, secure)
  - `generated_yaml` (text): Generated YAML content
  - `security_features` (jsonb): Enabled security features
  - `status` (text): Pipeline status (draft, pushed, active)
  - `pushed_at` (timestamptz): When pushed to GitHub
  - `created_at` (timestamptz): Pipeline creation timestamp
  - `updated_at` (timestamptz): Last update timestamp

  ### 4. `security_scans`
  Stores security scan results
  - `id` (uuid, primary key): Unique scan identifier
  - `pipeline_id` (uuid, foreign key): Associated pipeline
  - `scan_type` (text): Type of scan (sast, dast, secrets, dependencies)
  - `vulnerabilities_count` (integer): Number of vulnerabilities found
  - `risk_level` (text): Risk level (low, medium, high, critical)
  - `findings` (jsonb): Detailed scan findings
  - `created_at` (timestamptz): Scan timestamp

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Policies enforce user ownership for all operations
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id bigint UNIQUE NOT NULL,
  username text NOT NULL,
  email text,
  avatar_url text,
  access_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repo_id bigint NOT NULL,
  repo_name text NOT NULL,
  repo_full_name text NOT NULL,
  repo_url text NOT NULL,
  default_branch text DEFAULT 'main',
  is_private boolean DEFAULT false,
  stack_detected jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, github_repo_id)
);

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pipeline_type text DEFAULT 'secure',
  generated_yaml text NOT NULL,
  security_features jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'draft',
  pushed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create security_scans table
CREATE TABLE IF NOT EXISTS security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  scan_type text NOT NULL,
  vulnerabilities_count integer DEFAULT 0,
  risk_level text DEFAULT 'low',
  findings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_repo_id ON pipelines(repo_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_pipeline_id ON security_scans(pipeline_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for repositories table
CREATE POLICY "Users can view own repositories"
  ON repositories FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own repositories"
  ON repositories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own repositories"
  ON repositories FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own repositories"
  ON repositories FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for pipelines table
CREATE POLICY "Users can view own pipelines"
  ON pipelines FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pipelines"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pipelines"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pipelines"
  ON pipelines FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for security_scans table
CREATE POLICY "Users can view own security scans"
  ON security_scans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = security_scans.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own security scans"
  ON security_scans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at
  BEFORE UPDATE ON repositories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();