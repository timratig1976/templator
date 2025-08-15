import express from 'express';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Static test files metadata
const staticFiles = [
  {
    id: '1',
    name: 'landing-page-1.html',
    displayName: 'Landing Page Example',
    size: 0, // Will be calculated
    type: 'text/html',
    uploadedAt: '2024-01-15T10:30:00Z',
    dimensions: { width: 1920, height: 1080 },
    complexity: 'medium',
    description: 'Modern landing page with header, hero, features, testimonials, and footer sections'
  },
  {
    id: '2', 
    name: 'ecommerce-homepage.html',
    displayName: 'E-commerce Homepage',
    size: 0, // Will be calculated
    type: 'text/html',
    uploadedAt: '2024-01-14T15:20:00Z',
    dimensions: { width: 1440, height: 900 },
    complexity: 'high',
    description: 'Complex e-commerce layout with navigation, search, categories, products, and newsletter'
  },
  {
    id: '3',
    name: 'simple-blog.html',
    displayName: 'Simple Blog Layout',
    size: 0, // Will be calculated
    type: 'text/html',
    uploadedAt: '2024-01-13T09:15:00Z',
    dimensions: { width: 1200, height: 800 },
    complexity: 'low',
    description: 'Clean blog layout with header, navigation, main content, sidebar, and footer'
  }
];

// Ensure uploads directory exists (for uploaded test files)
const uploadsDir = path.join(__dirname, '../../../uploads/static-test-files');
async function ensureUploadsDir() {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (e) {
    // ignore if exists
  }
}

// Very small helper to map simple extensions to mime types without external deps
function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'html': return 'text/html; charset=utf-8';
    case 'htm': return 'text/html; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

// Normalize response shape for a file entry
function toFileEntry(id: string, name: string, size: number, type: string, uploadedAt: string) {
  return {
    id,
    name,
    size,
    type,
    uploadedAt,
  } as any;
}

// Get list of static test files
router.get('/list', async (req, res) => {
  try {
    const staticFilesDir = path.join(__dirname, '../../../frontend/public/static-test-files');

    // Calculate file sizes for bundled static examples (prefix with s-)
    const staticWithSizes = await Promise.all(
      staticFiles.map(async (file) => {
        try {
          const filePath = path.join(staticFilesDir, file.name);
          const stats = await fs.stat(filePath);
          return {
            ...file,
            id: `s-${file.id}`,
            size: stats.size
          };
        } catch (error) {
          console.warn(`Could not get stats for ${file.name}:`, error);
          return { ...file, id: `s-${file.id}` };
        }
      })
    );

    // Discover user-uploaded files (prefix with u-)
    await ensureUploadsDir();
    let uploaded: any[] = [];
    try {
      const names = await fs.readdir(uploadsDir);
      uploaded = await Promise.all(names.map(async (name) => {
        const filePath = path.join(uploadsDir, name);
        const stats = await fs.stat(filePath);
        const type = guessMimeType(name);
        const uploadedAt = new Date(stats.mtimeMs).toISOString();
        return toFileEntry(`u-${name}`, name, stats.size, type, uploadedAt);
      }));
    } catch (err) {
      // If directory not readable, continue with static only
      console.warn('Could not read uploads directory:', err);
    }

    // Merge lists: uploaded first (most recent) then statics
    const data = [...uploaded.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)), ...staticWithSizes];

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error listing static files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list static files'
    });
  }
});

// Get specific static file content
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id.startsWith('u-')) {
      // Uploaded file
      const name = id.slice(2);
      const filePath = path.join(uploadsDir, name);
      try {
        const buffer = await fs.readFile(filePath);
        const type = guessMimeType(name);
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Disposition', `inline; filename="${name}"`);
        return res.send(buffer);
      } catch (fileError) {
        console.error(`Error reading uploaded file ${name}:`, fileError);
        return res.status(404).json({ success: false, error: 'File content not found' });
      }
    } else {
      // Static bundled file (ids are prefixed s-)
      const staticId = id.startsWith('s-') ? id.slice(2) : id; // backward compatibility
      const file = staticFiles.find(f => f.id === staticId);
      if (!file) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
      const staticFilesDir = path.join(__dirname, '../../../frontend/public/static-test-files');
      const filePath = path.join(staticFilesDir, file.name);
      try {
        const content = await fs.readFile(filePath);
        res.setHeader('Content-Type', file.type);
        res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
        return res.send(content);
      } catch (fileError) {
        console.error(`Error reading file ${file.name}:`, fileError);
        return res.status(404).json({ success: false, error: 'File content not found' });
      }
    }
  } catch (error) {
    console.error('Error serving static file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve static file'
    });
  }
});

// Get file as blob for testing (used by StaticFileManager)
router.get('/:id/blob', async (req, res) => {
  try {
    const { id } = req.params;
    if (id.startsWith('u-')) {
      const name = id.slice(2);
      const filePath = path.join(uploadsDir, name);
      try {
        const content = await fs.readFile(filePath);
        const type = guessMimeType(name);
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Length', content.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(content);
      } catch (fileError) {
        console.error(`Error reading uploaded file ${name}:`, fileError);
        return res.status(404).json({ success: false, error: 'File content not found' });
      }
    } else {
      const staticId = id.startsWith('s-') ? id.slice(2) : id;
      const file = staticFiles.find(f => f.id === staticId);
      if (!file) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }
      const staticFilesDir = path.join(__dirname, '../../../frontend/public/static-test-files');
      const filePath = path.join(staticFilesDir, file.name);
      try {
        const content = await fs.readFile(filePath);
        res.setHeader('Content-Type', file.type);
        res.setHeader('Content-Length', content.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(content);
      } catch (fileError) {
        console.error(`Error reading file ${file.name}:`, fileError);
        return res.status(404).json({ success: false, error: 'File content not found' });
      }
    }
  } catch (error) {
    console.error('Error serving static file blob:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve static file blob'
    });
  }
});

// Upload endpoint (JSON body with dataUrl to avoid multipart dependency)
// Body: { name: string, type: string, dataUrl: string }
router.post('/upload-json', async (req, res) => {
  try {
    const { name, type, dataUrl } = req.body || {};
    if (!name || !dataUrl) {
      return res.status(400).json({ success: false, error: 'Missing name or dataUrl' });
    }
    // dataUrl format: data:<mime>;base64,<data>
    const commaIdx = (dataUrl as string).indexOf(',');
    if (commaIdx === -1) {
      return res.status(400).json({ success: false, error: 'Invalid dataUrl format' });
    }
    const base64 = (dataUrl as string).slice(commaIdx + 1);
    const buffer = Buffer.from(base64, 'base64');
    await ensureUploadsDir();
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(uploadsDir, safeName);
    await fs.writeFile(filePath, buffer);
    const stats = await fs.stat(filePath);
    const fileType = type || guessMimeType(safeName);
    return res.json({
      success: true,
      data: toFileEntry(`u-${safeName}`, safeName, stats.size, fileType, new Date(stats.mtimeMs).toISOString())
    });
  } catch (error) {
    console.error('Error uploading static test file:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// Delete uploaded file (only applies to uploaded entries)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.startsWith('u-')) {
      return res.status(400).json({ success: false, error: 'Cannot delete bundled static files' });
    }
    const name = id.slice(2);
    const filePath = path.join(uploadsDir, name);
    try {
      await fs.unlink(filePath);
      return res.json({ success: true });
    } catch (e) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    console.error('Error deleting uploaded file:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

export default router;
