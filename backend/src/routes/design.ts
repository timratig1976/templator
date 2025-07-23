import { Router } from 'express';
import { 
  uploadDesign, 
  convertDesignToHTML, 
  refineHTML, 
  getSupportedFileTypes 
} from '../controllers/designController';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const refineHTMLSchema = Joi.object({
  html: Joi.string().required().min(10).max(50000),
  requirements: Joi.string().optional().max(1000)
});

// Routes
router.get('/supported-types', getSupportedFileTypes);

router.post('/upload', uploadDesign, convertDesignToHTML);

router.post('/refine', validateRequest(refineHTMLSchema), refineHTML);

export default router;
