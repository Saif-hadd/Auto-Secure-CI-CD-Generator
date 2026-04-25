import { RemediationService } from '../services/remediation.service.js';
import { logger } from '../utils/logger.js';

export const runRemediation = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { projectPath } = req.body;

    const path = projectPath || process.cwd();

    const result = await RemediationService.runAutoRemediation(
      pipelineId,
      req.user.id,
      req.user.access_token,
      path
    );

    res.json(result);
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Run remediation error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const getRemediationHistory = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const history = await RemediationService.getRemediationHistory(pipelineId, req.user.id);

    res.json({
      success: true,
      remediations: history
    });
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Get remediation history error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const getLatestRemediation = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const remediation = await RemediationService.getLatestRemediation(pipelineId, req.user.id);

    if (!remediation) {
      return res.status(404).json({ error: 'No remediation found' });
    }

    res.json({
      success: true,
      remediation
    });
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Get latest remediation error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};
