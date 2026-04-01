import { SecurityService } from '../services/security.service.js';
import { PipelineService } from '../services/pipeline.service.js';

export const runSecurityScan = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { scannerType = 'trivy', projectPath } = req.body;

    const path = projectPath || process.cwd();

    const scanResult = await SecurityService.scanRepository(path, {
      scannerType,
      pipelineId
    });

    res.json({
      success: true,
      ...scanResult
    });
  } catch (error) {
    console.error('Run security scan error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getScanHistory = async (req, res) => {
  try {
    const { pipelineId } = req.params;

    const history = await SecurityService.getScanHistory(pipelineId);

    res.json({
      success: true,
      scans: history
    });
  } catch (error) {
    console.error('Get scan history error:', error);
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

    const comparison = await SecurityService.compareScanResults(pipelineId, scanType);

    res.json({
      success: true,
      ...comparison
    });
  } catch (error) {
    console.error('Compare scan results error:', error);
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

    const scan = await SecurityService.getLatestScanByType(pipelineId, scanType);

    if (!scan) {
      return res.status(404).json({ error: 'No scan found for this type' });
    }

    res.json({
      success: true,
      scan: SecurityService.formatScanForResponse(scan)
    });
  } catch (error) {
    console.error('Get latest scan error:', error);
    res.status(500).json({ error: error.message });
  }
};
