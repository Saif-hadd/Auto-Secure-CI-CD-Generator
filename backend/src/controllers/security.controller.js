import { SecurityService } from '../services/security.service.js';
import { PipelineService } from '../services/pipeline.service.js';
import { logger } from '../utils/logger.js';

export const runSecurityScan = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { scannerType = 'trivy', projectPath } = req.body;

    const path = projectPath || process.cwd();

    const scanResult = await SecurityService.scanRepository(path, {
      scannerType,
      pipelineId,
      userId: req.user.id
    });

    res.json({
      success: true,
      ...scanResult
    });
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Run security scan error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const getScanHistory = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const history = await SecurityService.getScanHistory(pipelineId, req.user.id);

    res.json({
      success: true,
      scans: history
    });
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id }, err: error }, 'Get scan history error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const compareScanResults = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { scanType } = req.query;

    if (!scanType) {
      return res.status(400).json({ error: 'scanType query parameter required' });
    }

    const comparison = await SecurityService.compareScanResults(pipelineId, scanType, req.user.id);

    res.json({
      success: true,
      ...comparison
    });
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id, scanType: req.query.scanType }, err: error }, 'Compare scan results error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};

export const getLatestScan = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { scanType } = req.query;

    if (!scanType) {
      return res.status(400).json({ error: 'scanType query parameter required' });
    }

    const scan = await SecurityService.getLatestScanByType(pipelineId, scanType, req.user.id);

    if (!scan) {
      return res.status(404).json({ error: 'No scan found for this type' });
    }

    res.json({
      success: true,
      scan: SecurityService.formatScanForResponse(scan)
    });
  } catch (error) {
    logger.error({ context: { pipelineId: req.params.pipelineId, userId: req.user?.id, scanType: req.query.scanType }, err: error }, 'Get latest scan error'); // FIX: replace console logging with structured logger
    res.status(500).json({ error: error.message });
  }
};
