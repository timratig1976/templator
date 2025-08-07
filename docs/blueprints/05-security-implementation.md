# 🔒 Security Implementation Blueprint
## OWASP-Compliant Security Patterns for Enterprise Applications

*Comprehensive security implementation guide based on OWASP standards and proven patterns from production systems. Includes complete code examples and best practices for building secure applications.*

---

## 🎯 **Security Principles**

### **Core Security Standards**
- **OWASP ASVS Level 2 Compliance**: Application Security Verification Standard
- **Defense in Depth**: Multiple layers of security controls
- **Security by Design**: Security considerations from project inception
- **Zero Trust Architecture**: Never trust, always verify
- **Principle of Least Privilege**: Minimal access rights

---

## 🛡️ **Security Middleware Stack**

### **Complete Security Middleware Implementation**
```typescript
// src/middleware/security.middleware.ts
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https://api.openai.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }),

  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  })
];
```

---

## 🔐 **Authentication & Authorization**

### **JWT Authentication Service**
```typescript
// src/services/auth/JwtService.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
  }

  generateTokens(payload: { userId: string; email: string; role: string }) {
    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '15m'
    });

    const refreshToken = jwt.sign(
      { userId: payload.userId },
      this.refreshTokenSecret,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string) {
    return jwt.verify(token, this.accessTokenSecret);
  }
}

// Authentication middleware
export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, error: 'Access token required' });
      return;
    }

    const jwtService = new JwtService();
    const payload = jwtService.verifyAccessToken(token) as any;
    req.user = payload;
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Invalid token' });
  }
};
```

---

## 🛡️ **Input Validation & Sanitization**

### **Validation Middleware**
```typescript
// src/middleware/validation.middleware.ts
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

export const sanitizeHtml = (html: string): string => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['class', 'id', 'data-*']
  });
};

export const validateFileUpload = z.object({
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  size: z.number().max(50 * 1024 * 1024), // 50MB max
  filename: z.string().regex(/^[a-zA-Z0-9._-]+$/)
});

export const userValidationSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128)
});
```

---

## 🔒 **Data Protection & Encryption**

### **Encryption Service**
```typescript
// src/services/security/EncryptionService.ts
import crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY!;
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, { iv });
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(
      this.algorithm, 
      this.encryptionKey, 
      { iv: Buffer.from(encryptedData.iv, 'hex') }
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

---

## 🚨 **Security Monitoring & Logging**

### **Security Event Logger**
```typescript
// src/services/security/SecurityLogger.ts
import winston from 'winston';
import { Request } from 'express';

export class SecurityLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/security.log' }),
        new winston.transports.File({ filename: 'logs/security-errors.log', level: 'error' })
      ]
    });
  }

  logAuthenticationAttempt(req: Request, success: boolean, userId?: string): void {
    this.logger.info('Authentication attempt', {
      success,
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date()
    });
  }

  logSuspiciousActivity(req: Request, reason: string): void {
    this.logger.warn('Suspicious activity detected', {
      reason,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
      timestamp: new Date()
    });
  }
}
```

---

## 🔧 **Security Configuration**

### **Environment Variables**
```bash
# .env.example
JWT_ACCESS_SECRET=your-super-secret-access-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
ENCRYPTION_KEY=your-encryption-key-here
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
MAX_UPLOAD_SIZE=52428800
```

### **Security Checklist**
- [ ] Implement HTTPS in production
- [ ] Set up proper CORS configuration
- [ ] Configure security headers with Helmet
- [ ] Implement rate limiting
- [ ] Add input validation and sanitization
- [ ] Set up authentication and authorization
- [ ] Encrypt sensitive data
- [ ] Implement security logging
- [ ] Regular security audits
- [ ] Keep dependencies updated

---

*This security blueprint provides a comprehensive foundation for building secure applications. Adapt the patterns to your specific requirements and always stay updated with the latest security best practices.*
