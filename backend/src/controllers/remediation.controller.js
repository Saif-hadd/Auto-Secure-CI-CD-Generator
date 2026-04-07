import { RemediationService } from '../services/remediation.service.js';

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
    console.error('Run remediation error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getRemediationHistory = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const history = await RemediationService.getRemediationHistory(pipelineId);

    res.json({
      success: true,
      remediations: history
    });
  } catch (error) {
    console.error('Get remediation history error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getLatestRemediation = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const remediation = await RemediationService.getLatestRemediation(pipelineId);

    if (!remediation) {
      return res.status(404).json({ error: 'No remediation found' });
    }

    res.json({
      success: true,
      remediation
    });
  } catch (error) {
    console.error('Get latest remediation error:', error);
    res.status(500).json({ error: error.message });
  }
};
