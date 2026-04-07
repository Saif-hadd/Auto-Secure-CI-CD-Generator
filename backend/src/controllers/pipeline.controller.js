import { PipelineService } from '../services/pipeline.service.js';

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
    console.error('Generate pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPipelinesByRepo = async (req, res) => {
  try {
    const { repoId } = req.params;
    const pipelines = await PipelineService.getPipelinesByRepo(repoId, req.user.id);
    res.json({ pipelines });
  } catch (error) {
    console.error('Get pipelines error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const pushPipelineToGitHub = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const result = await PipelineService.pushToGitHub(
      pipelineId,
      req.user.id,
      req.user.access_token
    );

    res.json(result);
  } catch (error) {
    console.error('Push pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getSecurityDashboard = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const dashboard = await PipelineService.getSecurityDashboard(pipelineId, req.user.id);
    res.json(dashboard);
  } catch (error) {
    console.error('Get security dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};
