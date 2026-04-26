import { RepoService } from '../services/repo.service.js';
import { logger } from '../utils/logger.js';

export const getUserRepositories = async (req, res) => {
  try {
    const repositories = await RepoService.getUserRepositories(req.user.id);
    res.json({ repositories });
  } catch (error) {
    logger.error({ context: { userId: req.user?.id }, err: error }, 'Get repositories error');
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
    logger.error({ context: { repoId: req.params.repoId, userId: req.user?.id }, err: error }, 'Get repository error');
    res.status(500).json({ error: error.message });
  }
};

export const syncRepositories = async (req, res) => {
  try {
    const repositories = await RepoService.syncUserRepositories(req.user.id);
    res.json({ repositories });
  } catch (error) {
    logger.error({ context: { userId: req.user?.id }, err: error }, 'Sync repositories error');
    res.status(500).json({ error: error.message });
  }
};

export const detectStack = async (req, res) => {
  try {
    const { repoId } = req.params;
    const stack = await RepoService.detectTechStack(repoId, req.user.id);
    res.json({ stack });
  } catch (error) {
    logger.error({ context: { repoId: req.params.repoId, userId: req.user?.id }, err: error }, 'Detect stack error');
    res.status(500).json({ error: error.message });
  }
};
