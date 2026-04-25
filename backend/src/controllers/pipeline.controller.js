import { PipelineService } from '../services/pipeline.service.js';
import { logger } from '../utils/logger.js';

export const generatePipeline = async (req, res) => {
  try {
    const { repoId, pipelineType = 'secure' } = req.body;

    if (!repoId) {
      return res.status(400).json({ error: 'Repository ID required' });
    }

    const pipeline = await PipelineService.generatePipeline(
      repoId,
      req.user.id,
      pipelineType
    );

    res.json({ pipeline });
  } catch (error) {
    logger.error({ context: { repoId: req.body.repoId, userId: req.user?.id }, err: error }, 'Generate pipeline error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const getPipelinesByRepo = async (req, res) => {
  try {
    const { repoId } = req.params;
    const pipelines = await PipelineService.getPipelinesByRepo(repoId, req.user.id);
    res.json({ pipelines });
  } catch (error) {
    logger.error({ context: { repoId: req.params.repoId, userId: req.user?.id }, err: error }, 'Get pipelines error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const pushPipelineToGitHub = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    // ✅ accessToken supprimé — le service le prend depuis la DB
    const result = await PipelineService.pushToGitHub(
      pipelineId,
      req.user.id
    );

    res.json(result);
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Push pipeline error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const getSecurityDashboard = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const dashboard = await PipelineService.getSecurityDashboard(pipelineId, req.user.id);
    res.json(dashboard);
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Get security dashboard error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};
