# 🏗️ Domain-Driven Design Blueprint
## Enterprise Architecture with Clear Domain Boundaries

*Comprehensive DDD implementation guide based on proven patterns from production systems. Includes complete domain modeling, service organization, and architectural patterns.*

---

## 🎯 **Domain-Driven Design Principles**

### **Core Concepts**
- **Domain Modeling**: Business logic organized around domain concepts
- **Bounded Contexts**: Clear boundaries between different business areas
- **Ubiquitous Language**: Shared vocabulary between developers and domain experts
- **Aggregate Roots**: Consistency boundaries for data modifications
- **Domain Services**: Business logic that doesn't naturally fit in entities

### **Architecture Benefits**
- **Business Alignment**: Code structure reflects business structure
- **Maintainability**: Clear separation of concerns and responsibilities
- **Scalability**: Independent domains can scale separately
- **Team Organization**: Teams can own specific domains
- **Knowledge Preservation**: Business rules captured in code

---

## 📁 **Domain Organization Structure**

```
src/domains/
├── user/                    # User Management Domain
│   ├── user.controller.ts   # HTTP endpoints
│   ├── user.service.ts      # Domain service
│   ├── user.repository.ts   # Data access
│   ├── user.entity.ts       # Domain entity
│   ├── user.dto.ts          # Data transfer objects
│   ├── user.types.ts        # Domain types
│   ├── user.validators.ts   # Domain validation
│   ├── user.events.ts       # Domain events
│   └── user.module.ts       # Module configuration
├── project/                 # Project Management Domain
│   ├── project.controller.ts
│   ├── project.service.ts
│   ├── project.repository.ts
│   ├── project.entity.ts
│   ├── project.dto.ts
│   ├── project.types.ts
│   ├── project.validators.ts
│   ├── project.events.ts
│   └── project.module.ts
├── template/                # Template Management Domain
│   ├── template.controller.ts
│   ├── template.service.ts
│   ├── template.repository.ts
│   ├── template.entity.ts
│   ├── template.dto.ts
│   ├── template.types.ts
│   ├── template.validators.ts
│   ├── template.events.ts
│   └── template.module.ts
├── ai/                      # AI Processing Domain
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   ├── ai.repository.ts
│   ├── ai.entity.ts
│   ├── ai.dto.ts
│   ├── ai.types.ts
│   ├── ai.validators.ts
│   ├── ai.events.ts
│   └── ai.module.ts
└── analytics/               # Analytics Domain
    ├── analytics.controller.ts
    ├── analytics.service.ts
    ├── analytics.repository.ts
    ├── analytics.entity.ts
    ├── analytics.dto.ts
    ├── analytics.types.ts
    ├── analytics.validators.ts
    ├── analytics.events.ts
    └── analytics.module.ts
```

---

## 🏛️ **Domain Implementation Patterns**

### **Domain Entity Pattern**
```typescript
// src/domains/project/project.entity.ts
import { ProjectStatus, ProjectSettings } from './project.types';
import { DomainEvent } from '../../shared/domain/DomainEvent';
import { ProjectCreatedEvent, ProjectStatusChangedEvent } from './project.events';

export class Project {
  private _id: string;
  private _name: string;
  private _description: string;
  private _ownerId: string;
  private _status: ProjectStatus;
  private _settings: ProjectSettings;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(
    id: string,
    name: string,
    description: string,
    ownerId: string,
    status: ProjectStatus = ProjectStatus.DRAFT,
    settings: ProjectSettings,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    this._id = id;
    this._name = name;
    this._description = description;
    this._ownerId = ownerId;
    this._status = status;
    this._settings = settings;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;

    // Domain event for new project creation
    if (createdAt.getTime() === updatedAt.getTime()) {
      this.addDomainEvent(new ProjectCreatedEvent(this._id, this._ownerId, this._name));
    }
  }

  // Getters
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get ownerId(): string { return this._ownerId; }
  get status(): ProjectStatus { return this._status; }
  get settings(): ProjectSettings { return this._settings; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  // Business methods
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Project name cannot be empty');
    }
    if (newName.length > 100) {
      throw new Error('Project name cannot exceed 100 characters');
    }
    
    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  updateDescription(newDescription: string): void {
    if (newDescription && newDescription.length > 1000) {
      throw new Error('Project description cannot exceed 1000 characters');
    }
    
    this._description = newDescription;
    this._updatedAt = new Date();
  }

  changeStatus(newStatus: ProjectStatus): void {
    if (this._status === newStatus) {
      return; // No change needed
    }

    // Business rules for status transitions
    if (!this.isValidStatusTransition(this._status, newStatus)) {
      throw new Error(`Invalid status transition from ${this._status} to ${newStatus}`);
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    // Domain event for status change
    this.addDomainEvent(new ProjectStatusChangedEvent(this._id, oldStatus, newStatus));
  }

  updateSettings(newSettings: Partial<ProjectSettings>): void {
    this._settings = { ...this._settings, ...newSettings };
    this._updatedAt = new Date();
  }

  canBeEditedBy(userId: string): boolean {
    return this._ownerId === userId || this._settings.collaborators.some(
      collab => collab.userId === userId && collab.canEdit
    );
  }

  canBeDeletedBy(userId: string): boolean {
    return this._ownerId === userId;
  }

  // Domain event management
  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private isValidStatusTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      [ProjectStatus.DRAFT]: [ProjectStatus.PROCESSING, ProjectStatus.ARCHIVED],
      [ProjectStatus.PROCESSING]: [ProjectStatus.COMPLETED, ProjectStatus.FAILED, ProjectStatus.DRAFT],
      [ProjectStatus.COMPLETED]: [ProjectStatus.PUBLISHED, ProjectStatus.ARCHIVED, ProjectStatus.DRAFT],
      [ProjectStatus.PUBLISHED]: [ProjectStatus.ARCHIVED, ProjectStatus.DRAFT],
      [ProjectStatus.FAILED]: [ProjectStatus.DRAFT, ProjectStatus.PROCESSING],
      [ProjectStatus.ARCHIVED]: [ProjectStatus.DRAFT]
    };

    return validTransitions[from]?.includes(to) || false;
  }

  // Factory methods
  static create(
    name: string,
    description: string,
    ownerId: string,
    settings: ProjectSettings
  ): Project {
    const id = this.generateId();
    return new Project(id, name, description, ownerId, ProjectStatus.DRAFT, settings);
  }

  static fromPersistence(data: any): Project {
    return new Project(
      data.id,
      data.name,
      data.description,
      data.ownerId,
      data.status,
      data.settings,
      data.createdAt,
      data.updatedAt
    );
  }

  private static generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### **Domain Service Pattern**
```typescript
// src/domains/project/project.service.ts
import { Project } from './project.entity';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { ProjectStatus, ProjectSettings } from './project.types';
import { UserService } from '../user/user.service';
import { TemplateService } from '../template/template.service';
import { DomainEventPublisher } from '../../shared/domain/DomainEventPublisher';
import { ProjectNotFoundError, ProjectAccessDeniedError } from './project.errors';

export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly userService: UserService,
    private readonly templateService: TemplateService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async createProject(dto: CreateProjectDto, ownerId: string): Promise<Project> {
    // Validate owner exists
    const owner = await this.userService.findById(ownerId);
    if (!owner) {
      throw new Error('Owner not found');
    }

    // Validate template if provided
    if (dto.templateId) {
      const template = await this.templateService.findById(dto.templateId);
      if (!template) {
        throw new Error('Template not found');
      }
    }

    // Create project settings
    const settings: ProjectSettings = {
      isPublic: dto.isPublic || false,
      allowComments: dto.allowComments || false,
      enableAnalytics: dto.enableAnalytics || true,
      collaborators: [],
      customDomain: dto.customDomain
    };

    // Create project entity
    const project = Project.create(
      dto.name,
      dto.description,
      ownerId,
      settings
    );

    // Persist project
    const savedProject = await this.projectRepository.save(project);

    // Publish domain events
    await this.publishDomainEvents(savedProject);

    return savedProject;
  }

  async updateProject(
    projectId: string, 
    dto: UpdateProjectDto, 
    userId: string
  ): Promise<Project> {
    const project = await this.findProjectById(projectId);
    
    if (!project.canBeEditedBy(userId)) {
      throw new ProjectAccessDeniedError('User cannot edit this project');
    }

    // Apply updates
    if (dto.name !== undefined) {
      project.updateName(dto.name);
    }
    if (dto.description !== undefined) {
      project.updateDescription(dto.description);
    }
    if (dto.settings !== undefined) {
      project.updateSettings(dto.settings);
    }

    // Persist changes
    const updatedProject = await this.projectRepository.save(project);

    // Publish domain events
    await this.publishDomainEvents(updatedProject);

    return updatedProject;
  }

  async changeProjectStatus(
    projectId: string, 
    newStatus: ProjectStatus, 
    userId: string
  ): Promise<Project> {
    const project = await this.findProjectById(projectId);
    
    if (!project.canBeEditedBy(userId)) {
      throw new ProjectAccessDeniedError('User cannot modify this project');
    }

    project.changeStatus(newStatus);

    const updatedProject = await this.projectRepository.save(project);
    await this.publishDomainEvents(updatedProject);

    return updatedProject;
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await this.findProjectById(projectId);
    
    if (!project.canBeDeletedBy(userId)) {
      throw new ProjectAccessDeniedError('User cannot delete this project');
    }

    await this.projectRepository.delete(projectId);
  }

  async findProjectById(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(`Project with id ${projectId} not found`);
    }
    return project;
  }

  async findProjectsByOwner(ownerId: string): Promise<Project[]> {
    return this.projectRepository.findByOwnerId(ownerId);
  }

  async findPublicProjects(limit = 20, offset = 0): Promise<Project[]> {
    return this.projectRepository.findPublicProjects(limit, offset);
  }

  // Domain-specific business logic
  async duplicateProject(
    projectId: string, 
    newName: string, 
    userId: string
  ): Promise<Project> {
    const originalProject = await this.findProjectById(projectId);
    
    if (!originalProject.canBeEditedBy(userId)) {
      throw new ProjectAccessDeniedError('User cannot access this project');
    }

    const duplicatedProject = Project.create(
      newName,
      `Copy of ${originalProject.description}`,
      userId,
      originalProject.settings
    );

    return this.projectRepository.save(duplicatedProject);
  }

  async getProjectStatistics(projectId: string): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    lastModified: Date;
    collaboratorCount: number;
  }> {
    const project = await this.findProjectById(projectId);
    
    // This would integrate with analytics domain
    return {
      totalViews: 0, // Would come from analytics service
      uniqueVisitors: 0, // Would come from analytics service
      lastModified: project.updatedAt,
      collaboratorCount: project.settings.collaborators.length
    };
  }

  private async publishDomainEvents(project: Project): Promise<void> {
    const events = project.domainEvents;
    project.clearDomainEvents();

    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
```

### **Repository Pattern**
```typescript
// src/domains/project/project.repository.ts
import { Project } from './project.entity';
import { ProjectStatus } from './project.types';

export interface ProjectRepository {
  save(project: Project): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByOwnerId(ownerId: string): Promise<Project[]>;
  findPublicProjects(limit: number, offset: number): Promise<Project[]>;
  findByStatus(status: ProjectStatus): Promise<Project[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  countByOwner(ownerId: string): Promise<number>;
}

// Implementation using Prisma
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(project: Project): Promise<Project> {
    const data = {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      status: project.status,
      settings: project.settings,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };

    const saved = await this.prisma.project.upsert({
      where: { id: project.id },
      update: data,
      create: data
    });

    return Project.fromPersistence(saved);
  }

  async findById(id: string): Promise<Project | null> {
    const found = await this.prisma.project.findUnique({
      where: { id }
    });

    return found ? Project.fromPersistence(found) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' }
    });

    return projects.map(p => Project.fromPersistence(p));
  }

  async findPublicProjects(limit: number, offset: number): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { 
        status: ProjectStatus.PUBLISHED,
        settings: {
          path: ['isPublic'],
          equals: true
        }
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' }
    });

    return projects.map(p => Project.fromPersistence(p));
  }

  async findByStatus(status: ProjectStatus): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' }
    });

    return projects.map(p => Project.fromPersistence(p));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({
      where: { id }
    });
  }

  async count(): Promise<number> {
    return this.prisma.project.count();
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.prisma.project.count({
      where: { ownerId }
    });
  }
}
```

### **Domain Events Pattern**
```typescript
// src/domains/project/project.events.ts
import { DomainEvent } from '../../shared/domain/DomainEvent';
import { ProjectStatus } from './project.types';

export class ProjectCreatedEvent extends DomainEvent {
  constructor(
    public readonly projectId: string,
    public readonly ownerId: string,
    public readonly projectName: string
  ) {
    super('ProjectCreated', projectId);
  }
}

export class ProjectStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly projectId: string,
    public readonly oldStatus: ProjectStatus,
    public readonly newStatus: ProjectStatus
  ) {
    super('ProjectStatusChanged', projectId);
  }
}

export class ProjectDeletedEvent extends DomainEvent {
  constructor(
    public readonly projectId: string,
    public readonly ownerId: string
  ) {
    super('ProjectDeleted', projectId);
  }
}

// Event handlers
export class ProjectEventHandlers {
  constructor(
    private readonly analyticsService: any,
    private readonly notificationService: any
  ) {}

  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    // Track project creation in analytics
    await this.analyticsService.trackEvent('project_created', {
      projectId: event.projectId,
      ownerId: event.ownerId,
      timestamp: event.occurredAt
    });

    // Send welcome notification
    await this.notificationService.sendNotification({
      userId: event.ownerId,
      type: 'project_created',
      title: 'Project Created Successfully',
      message: `Your project "${event.projectName}" has been created.`
    });
  }

  async handleProjectStatusChanged(event: ProjectStatusChangedEvent): Promise<void> {
    // Track status change
    await this.analyticsService.trackEvent('project_status_changed', {
      projectId: event.projectId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      timestamp: event.occurredAt
    });

    // Send notification for important status changes
    if (event.newStatus === ProjectStatus.COMPLETED) {
      // Notify project completion
    } else if (event.newStatus === ProjectStatus.FAILED) {
      // Notify project failure
    }
  }
}
```

---

## 🏛️ **Cross-Domain Communication**

### **Domain Event Publisher**
```typescript
// src/shared/domain/DomainEventPublisher.ts
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string
  ) {
    this.eventId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.occurredAt = new Date();
  }
}

export interface DomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export class DomainEventPublisher {
  private handlers: Map<string, DomainEventHandler<any>[]> = new Map();

  subscribe<T extends DomainEvent>(
    eventType: string, 
    handler: DomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    await Promise.all(
      handlers.map(handler => 
        handler.handle(event).catch(error => {
          console.error(`Error handling event ${event.eventType}:`, error);
        })
      )
    );
  }
}
```

### **Application Services (Use Cases)**
```typescript
// src/application/usecases/CreateProjectUseCase.ts
import { ProjectService } from '../domains/project/project.service';
import { UserService } from '../domains/user/user.service';
import { CreateProjectDto } from '../domains/project/project.dto';

export class CreateProjectUseCase {
  constructor(
    private readonly projectService: ProjectService,
    private readonly userService: UserService
  ) {}

  async execute(dto: CreateProjectDto, userId: string): Promise<{
    success: boolean;
    projectId?: string;
    error?: string;
  }> {
    try {
      // Validate user permissions
      const user = await this.userService.findById(userId);
      if (!user || !user.canCreateProjects()) {
        return {
          success: false,
          error: 'User does not have permission to create projects'
        };
      }

      // Check user project limits
      const projectCount = await this.projectService.countByOwner(userId);
      if (projectCount >= user.maxProjects) {
        return {
          success: false,
          error: 'User has reached maximum project limit'
        };
      }

      // Create project
      const project = await this.projectService.createProject(dto, userId);

      return {
        success: true,
        projectId: project.id
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

---

## 🔧 **Domain Module Configuration**

### **Domain Module Setup**
```typescript
// src/domains/project/project.module.ts
import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaProjectRepository } from './project.repository';
import { ProjectEventHandlers } from './project.events';
import { UserModule } from '../user/user.module';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [UserModule, TemplateModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    {
      provide: 'ProjectRepository',
      useClass: PrismaProjectRepository
    },
    ProjectEventHandlers
  ],
  exports: [ProjectService]
})
export class ProjectModule {}
```

### **Domain Types & DTOs**
```typescript
// src/domains/project/project.types.ts
export enum ProjectStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  FAILED = 'FAILED'
}

export interface ProjectSettings {
  isPublic: boolean;
  allowComments: boolean;
  enableAnalytics: boolean;
  customDomain?: string;
  collaborators: ProjectCollaborator[];
}

export interface ProjectCollaborator {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  canEdit: boolean;
  canDelete: boolean;
  addedAt: Date;
}

// src/domains/project/project.dto.ts
export interface CreateProjectDto {
  name: string;
  description: string;
  templateId?: string;
  isPublic?: boolean;
  allowComments?: boolean;
  enableAnalytics?: boolean;
  customDomain?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface ProjectResponseDto {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    name: string;
  };
}
```

---

## 📋 **DDD Implementation Checklist**

### **Domain Modeling**
- [ ] Identify bounded contexts
- [ ] Define domain entities with business rules
- [ ] Create value objects for domain concepts
- [ ] Implement aggregate roots
- [ ] Define domain services for complex business logic

### **Architecture Patterns**
- [ ] Repository pattern for data access
- [ ] Domain events for cross-domain communication
- [ ] Application services for use cases
- [ ] Domain event handlers for side effects
- [ ] Factory methods for entity creation

### **Code Organization**
- [ ] Separate domains into distinct modules
- [ ] Clear interfaces between domains
- [ ] Shared kernel for common concepts
- [ ] Anti-corruption layers for external systems
- [ ] Domain-specific error types

### **Testing Strategy**
- [ ] Unit tests for domain entities
- [ ] Integration tests for repositories
- [ ] Use case tests for application services
- [ ] Domain event testing
- [ ] Mock external dependencies

---

*This DDD blueprint provides a comprehensive foundation for building maintainable, business-aligned applications. The patterns ensure clear separation of concerns while maintaining flexibility for future growth and changes.*
