import { AnalyzerService } from '../services/analyzer.service.js';
import { logger } from '../utils/logger.js';

export const analyzeYAML = async (req, res) => {
  try {
    const { yaml } = req.body;

    if (!yaml) {
      return res.status(400).json({ error: 'YAML content required' });
    }

    const analysis = await AnalyzerService.analyzeYAML(yaml);
    res.json(analysis);
  } catch (error) {
    logger.error({ err: error }, 'Analyze YAML error');
    res.status(500).json({ error: error.message });
  }
};
