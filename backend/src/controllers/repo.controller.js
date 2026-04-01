import { RepoService } from '../services/repo.service.js';

export const getUserRepositories = async (req, res) => {
  try {
    const repositories = await RepoService.getUserRepositories(req.user.id);
    res.json({ repositories });
  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getRepositoryById = async (req, res) => {
  try {
    const { repoId } = req.params;
    const repository = await RepoService.getRepositoryById(repoId, req.user.id);

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json({ repository });
  } catch (error) {
    console.error('Get repository error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const syncRepositories = async (req, res) => {
  try {
    const repositories = await RepoService.syncUserRepositories(
      req.user.id,
      req.user.access_token
    );
    res.json({ repositories });
  } catch (error) {
    console.error('Sync repositories error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const detectStack = async (req, res) => {
  try {
    const { repoId } = req.params;
    const stack = await RepoService.detectTechStack(
      repoId,
      req.user.id,
      req.user.access_token
    );
    res.json({ stack });
  } catch (error) {
    console.error('Detect stack error:', error);
    res.status(500).json({ error: error.message });
  }
};
