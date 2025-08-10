# User Management, Authentication & Authorization Blueprint

## 🎯 **Overview**

Comprehensive blueprint for implementing enterprise-grade user management, authentication, and role-based access control (RBAC) system for the Templator platform.

## 🏗️ **Architecture Overview**

### **Core Components**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Database      │
│                 │    │                  │    │                 │
│ • Auth Context  │◄──►│ • Auth Service   │◄──►│ • Users         │
│ • Route Guards  │    │ • JWT Manager    │    │ • Roles         │
│ • Login/Signup  │    │ • RBAC Middleware│    │ • Permissions   │
│ • Profile Mgmt  │    │ • Session Store  │    │ • Sessions      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📊 **Database Schema Design**

### **Enhanced Prisma Schema**
```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  username        String?   @unique
  firstName       String?
  lastName        String?
  avatar          String?
  emailVerified   Boolean   @default(false)
  isActive        Boolean   @default(true)
  
  // Authentication
  passwordHash    String
  salt            String
  mfaEnabled      Boolean   @default(false)
  mfaSecret       String?
  
  // Profile & Preferences
  timezone        String    @default("UTC")
  language        String    @default("en")
  theme           String    @default("light")
  preferences     Json?
  
  // Metadata
  lastLoginAt     DateTime?
  lastActiveAt    DateTime?
  loginCount      Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relationships
  roleId          String
  role            Role      @relation(fields: [roleId], references: [id])
  sessions        Session[]
  auditLogs       AuditLog[]
  projects        Project[]
  apiKeys         ApiKey[]
  
  @@map("users")
}

model Role {
  id              String       @id @default(cuid())
  name            String       @unique // admin, manager, designer, viewer
  displayName     String       // "System Administrator"
  description     String?
  isSystem        Boolean      @default(false)
  isActive        Boolean      @default(true)
  
  // Hierarchy
  level           Int          @default(0) // 0=highest, 100=lowest
  parentRoleId    String?
  parentRole      Role?        @relation("RoleHierarchy", fields: [parentRoleId], references: [id])
  childRoles      Role[]       @relation("RoleHierarchy")
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  // Relationships
  users           User[]
  permissions     RolePermission[]
  
  @@map("roles")
}

model Permission {
  id              String       @id @default(cuid())
  name            String       @unique // "templates:create", "ai:analyze"
  resource        String       // "templates", "ai", "users"
  action          String       // "create", "read", "update", "delete"
  description     String?
  isSystem        Boolean      @default(false)
  
  // Scope & Constraints
  scope           String?      // "own", "team", "organization", "global"
  constraints     Json?
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  // Relationships
  roles           RolePermission[]
  
  @@unique([resource, action, scope])
  @@map("permissions")
}

model RolePermission {
  id              String       @id @default(cuid())
  roleId          String
  permissionId    String
  granted         Boolean      @default(true)
  constraints     Json?
  createdAt       DateTime     @default(now())
  
  role            Role         @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission      Permission   @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

model Session {
  id              String       @id @default(cuid())
  userId          String
  token           String       @unique
  refreshToken    String?      @unique
  
  // Session metadata
  deviceInfo      Json?
  ipAddress       String?
  location        Json?
  userAgent       String?
  
  // Session management
  isActive        Boolean      @default(true)
  expiresAt       DateTime
  lastAccessedAt  DateTime     @default(now())
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}

model ApiKey {
  id              String       @id @default(cuid())
  userId          String
  name            String
  keyHash         String       @unique
  
  // Configuration
  scopes          String[]
  rateLimit       Int?
  allowedIps      String[]
  
  // Status
  isActive        Boolean      @default(true)
  lastUsedAt      DateTime?
  usageCount      Int          @default(0)
  expiresAt       DateTime?
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("api_keys")
}

model AuditLog {
  id              String       @id @default(cuid())
  userId          String?
  sessionId       String?
  
  // Action details
  action          String
  resource        String?
  resourceType    String?
  
  // Request context
  method          String?
  endpoint        String?
  ipAddress       String?
  userAgent       String?
  
  // Results
  success         Boolean      @default(true)
  errorMessage    String?
  responseTime    Int?
  
  // Metadata
  metadata        Json?
  changes         Json?
  
  createdAt       DateTime     @default(now())
  
  user            User?        @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

## 🔐 **Authentication System**

### **JWT Token Strategy**
```typescript
interface JWTPayload {
  sub: string;           // User ID
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
  jti: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Validate credentials
    const user = await this.validateCredentials(credentials);
    
    // Create session
    const session = await this.sessionService.createSession(user.id, credentials.deviceInfo);
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user, session.id);
    const refreshToken = this.generateRefreshToken(user.id, session.id);
    
    // Update user login stats
    await this.updateLoginStats(user.id);
    
    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      permissions: await this.getUserPermissions(user.id)
    };
  }
  
  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
      
      // Validate session
      const session = await this.sessionService.validateSession(payload.sessionId);
      if (!session) return null;
      
      return session.user;
    } catch (error) {
      return null;
    }
  }
}
```

### **Multi-Factor Authentication**
```typescript
class MFAService {
  async setupMFA(userId: string): Promise<MFASetup> {
    const secret = speakeasy.generateSecret({
      name: `Templator (${user.email})`,
      issuer: 'Templator'
    });
    
    return {
      secret: secret.base32,
      qrCode: await QRCode.toDataURL(secret.otpauth_url),
      backupCodes: this.generateBackupCodes()
    };
  }
  
  async verifyMFA(userId: string, token: string): Promise<boolean> {
    const user = await this.userService.findById(userId);
    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      token,
      window: 2
    });
  }
}
```

## 🛡️ **Role-Based Access Control**

### **Permission System**
```typescript
const PERMISSIONS = {
  // Template permissions
  TEMPLATES_CREATE: 'templates:create:own',
  TEMPLATES_READ: 'templates:read:own',
  TEMPLATES_UPDATE: 'templates:update:own',
  TEMPLATES_DELETE: 'templates:delete:own',
  TEMPLATES_READ_ALL: 'templates:read:all',
  
  // AI permissions
  AI_ANALYZE: 'ai:analyze:own',
  AI_ADVANCED: 'ai:advanced:own',
  AI_BULK: 'ai:bulk:own',
  
  // User management
  USERS_CREATE: 'users:create:organization',
  USERS_READ: 'users:read:organization',
  USERS_UPDATE: 'users:update:organization',
  
  // System administration
  SYSTEM_ADMIN: 'system:admin:global',
  SYSTEM_AUDIT: 'system:audit:global'
};

const DEFAULT_ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    displayName: 'Super Administrator',
    level: 0,
    permissions: ['*:*:*']
  },
  ADMIN: {
    name: 'admin',
    displayName: 'Administrator',
    level: 10,
    permissions: [
      'templates:*:organization',
      'users:*:organization',
      'ai:*:organization'
    ]
  },
  DESIGNER: {
    name: 'designer',
    displayName: 'Designer',
    level: 30,
    permissions: [
      'templates:*:own',
      'ai:analyze:own',
      'ai:advanced:own'
    ]
  },
  VIEWER: {
    name: 'viewer',
    displayName: 'Viewer',
    level: 40,
    permissions: [
      'templates:read:shared',
      'ai:analyze:limited'
    ]
  }
};
```

### **Authorization Middleware**
```typescript
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const hasPermission = await authService.checkPermission(
        userId,
        permission,
        req.params.id
      );
      
      if (!hasPermission) {
        await auditService.log({
          userId,
          action: 'authorization:denied',
          resource: permission,
          metadata: { endpoint: req.path }
        });
        
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

## 🎨 **Frontend Implementation**

### **Authentication Context**
```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const login = async (credentials: LoginCredentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) throw new Error('Login failed');
    
    const { user, token, permissions } = await response.json();
    
    localStorage.setItem('auth_token', token);
    setUser(user);
    setPermissions(permissions);
  };
  
  const checkPermission = (permission: string): boolean => {
    return permissions.some(p => matchesPermission(p, permission));
  };
  
  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      checkPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### **Protected Routes**
```typescript
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  permission?: string;
  fallback?: React.ReactNode;
}> = ({ children, permission, fallback }) => {
  const { isAuthenticated, checkPermission, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginRedirect />;
  if (permission && !checkPermission(permission)) {
    return fallback || <UnauthorizedMessage />;
  }
  
  return <>{children}</>;
};
```

## 🔒 **Security Features**

### **Password Security**
```typescript
class PasswordService {
  private readonly SALT_ROUNDS = 12;
  private readonly MIN_LENGTH = 8;
  
  async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    this.validatePassword(password);
    
    const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    
    return { hash, salt };
  }
  
  validatePassword(password: string): void {
    if (password.length < this.MIN_LENGTH) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!complexityRegex.test(password)) {
      throw new Error('Password must contain uppercase, lowercase, number, and special character');
    }
  }
}
```

### **Rate Limiting**
```typescript
const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, max: 5 },
  SIGNUP: { windowMs: 60 * 60 * 1000, max: 3 },
  API_GENERAL: { windowMs: 15 * 60 * 1000, max: 100 },
  AI_ANALYSIS: { windowMs: 60 * 60 * 1000, max: 50 }
};
```

## 📊 **Implementation Timeline**

### **Phase 1: Core Authentication (Week 1-2)**
- [ ] Database schema migration
- [ ] JWT authentication service
- [ ] Basic login/logout endpoints
- [ ] Frontend auth context

### **Phase 2: Authorization System (Week 3-4)**
- [ ] RBAC implementation
- [ ] Permission middleware
- [ ] Protected route components
- [ ] Role management interface

### **Phase 3: Security Features (Week 5-6)**
- [ ] MFA implementation
- [ ] Session management
- [ ] Rate limiting
- [ ] Audit logging

### **Phase 4: User Management (Week 7-8)**
- [ ] Admin dashboard
- [ ] User CRUD operations
- [ ] Role assignment
- [ ] Audit trail viewer

## 🎯 **Success Metrics**

- **Security**: Zero authentication bypasses, <1% false positive rate
- **Performance**: <200ms authentication response time
- **Usability**: <3 clicks to access any authorized resource
- **Compliance**: GDPR, SOC2 compliance ready

This blueprint provides enterprise-grade user management with robust security, scalable architecture, and excellent user experience.
