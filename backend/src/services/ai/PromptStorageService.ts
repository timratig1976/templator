import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

interface PromptData {
  id: string;
  pipelineId: string;
  sectionId?: string;
  content: string;
  model: string;
  temperature: number;
  tokenCount: number;
  createdAt: string;
  promptType: string;
}

interface ResultData {
  id: string;
  pipelineId: string;
  sectionId?: string;
  content: string;
  generationTime: number;
  qualityScore: number;
  section: string;
  createdAt: string;
}

interface QualityMetrics {
  semanticsScore: number;
  tailwindScore: number;
  accessibilityScore: number;
  responsiveScore: number;
  issues?: Array<{
    severity: string;
    category: string;
    message: string;
    suggestion?: string;
  }>;
}

interface StoredPromptData {
  prompt: PromptData;
  result: ResultData;
  metrics?: QualityMetrics;
}

class PromptStorageService {
  private dataDir: string;

  constructor() {
    // Store prompt data under centralized storage path at backend/storage/ai/prompts
    // __dirname: backend/src/services/ai -> ../../../storage/ai/prompts => backend/storage/ai/prompts
    this.dataDir = path.join(__dirname, '../../../storage/ai/prompts');
    this.ensureDataDirExists();
  }

  /**
   * Store prompt data and generated result
   */
  async storePromptData(
    pipelineId: string,
    promptData: Partial<PromptData>,
    resultData: Partial<ResultData>,
    sectionId?: string,
    metrics?: QualityMetrics
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      // Create complete prompt data object
      const prompt: PromptData = {
        id: uuid(),
        pipelineId,
        sectionId,
        content: promptData.content || '',
        model: promptData.model || 'unknown',
        temperature: promptData.temperature || 0,
        tokenCount: promptData.tokenCount || 0,
        createdAt: timestamp,
        promptType: promptData.promptType || 'html-generation'
      };
      
      // Create complete result data object
      const result: ResultData = {
        id: uuid(),
        pipelineId,
        sectionId,
        content: resultData.content || '',
        generationTime: resultData.generationTime || 0,
        qualityScore: resultData.qualityScore || 0,
        section: resultData.section || 'unknown',
        createdAt: timestamp
      };
      
      // Combine into stored data object
      const storedData: StoredPromptData = {
        prompt,
        result,
        metrics
      };
      
      // Generate file path
      const fileName = sectionId 
        ? `${pipelineId}_${sectionId}.json` 
        : `${pipelineId}.json`;
      const filePath = path.join(this.dataDir, fileName);
      
      // Write data to file
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(storedData, null, 2)
      );
      
      logger.info('Prompt data stored successfully', {
        pipelineId,
        sectionId,
        filePath
      });
    } catch (error) {
      logger.error('Failed to store prompt data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pipelineId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Get stored prompt and result data
   */
  async getPromptAndResultData(
    pipelineId: string,
    sectionId?: string
  ): Promise<StoredPromptData | null> {
    try {
      // Generate file path
      const fileName = sectionId 
        ? `${pipelineId}_${sectionId}.json` 
        : `${pipelineId}.json`;
      const filePath = path.join(this.dataDir, fileName);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.warn('Prompt data file not found', {
          pipelineId,
          sectionId,
          filePath
        });
        return null;
      }
      
      // Read and parse file
      const fileData = await fs.promises.readFile(filePath, 'utf8');
      const parsedData: StoredPromptData = JSON.parse(fileData);
      
      logger.debug('Retrieved prompt data', {
        pipelineId,
        sectionId
      });
      
      return parsedData;
    } catch (error) {
      logger.error('Failed to retrieve prompt data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pipelineId,
        sectionId
      });
      return null;
    }
  }
  
  /**
   * Delete stored prompt data
   */
  async deletePromptData(
    pipelineId: string,
    sectionId?: string
  ): Promise<boolean> {
    try {
      // Generate file path
      const fileName = sectionId 
        ? `${pipelineId}_${sectionId}.json` 
        : `${pipelineId}.json`;
      const filePath = path.join(this.dataDir, fileName);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.warn('Prompt data file not found for deletion', {
          pipelineId,
          sectionId,
          filePath
        });
        return false;
      }
      
      // Delete file
      await fs.promises.unlink(filePath);
      
      logger.info('Prompt data deleted successfully', {
        pipelineId,
        sectionId
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete prompt data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pipelineId,
        sectionId
      });
      return false;
    }
  }
  
  /**
   * List all stored prompt data files
   */
  async listAllPromptData(): Promise<Array<{
    pipelineId: string;
    sectionId?: string;
    createdAt: string;
  }>> {
    try {
      // Get all files in data directory
      const files = await fs.promises.readdir(this.dataDir);
      
      // Filter for JSON files
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Process each file to extract metadata
      const results = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(this.dataDir, file);
            const fileData = await fs.promises.readFile(filePath, 'utf8');
            const parsedData: StoredPromptData = JSON.parse(fileData);
            
            // Extract pipeline and section IDs from filename
            const fileName = path.basename(file, '.json');
            const [pipelineId, sectionId] = fileName.split('_');
            
            return {
              pipelineId,
              sectionId: sectionId || undefined,
              createdAt: parsedData.prompt.createdAt
            };
          } catch (error) {
            logger.error('Error processing prompt data file', {
              error: error instanceof Error ? error.message : 'Unknown error',
              file
            });
            return null;
          }
        })
      );
      
      // Filter out any null results from errors
      return results.filter(item => item !== null) as { pipelineId: string; sectionId?: string; createdAt: string }[];
    } catch (error) {
      logger.error('Failed to list prompt data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }
  
  /**
   * Ensure data directory exists
   */
  private ensureDataDirExists(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        logger.debug('Created prompt data directory', {
          path: this.dataDir
        });
      }
    } catch (error) {
      logger.error('Failed to create prompt data directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: this.dataDir
      });
    }
  }
}

export default PromptStorageService;
