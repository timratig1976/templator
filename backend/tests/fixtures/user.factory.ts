/**
 * User Test Data Factory
 * Generates consistent test data for user-related tests
 */

import { faker } from '@faker-js/faker';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  hashedPassword?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export class UserFactory {
  /**
   * Create a valid user DTO for registration/creation
   */
  static createUserDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: faker.internet.password({ length: 12, memorable: false, pattern: /[A-Za-z0-9!@#$%^&*]/ }),
      ...overrides
    };
  }

  /**
   * Create a complete user entity for database operations
   */
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
      id: faker.string.uuid(),
      email: faker.internet.email({ firstName, lastName }),
      firstName,
      lastName,
      password: faker.internet.password({ length: 12 }),
      hashedPassword: faker.string.alphanumeric(60), // Simulated bcrypt hash
      isActive: true,
      createdAt: faker.date.recent({ days: 30 }),
      updatedAt: faker.date.recent({ days: 7 }),
      ...overrides
    };
  }

  /**
   * Create multiple users
   */
  static createMany(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  /**
   * Create a user with specific email domain
   */
  static createUserWithDomain(domain: string, overrides: Partial<TestUser> = {}): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
    
    return this.createUser({
      email,
      firstName,
      lastName,
      ...overrides
    });
  }

  /**
   * Create an admin user
   */
  static createAdminUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      email: 'admin@templator.com',
      firstName: 'Admin',
      lastName: 'User',
      ...overrides
    });
  }

  /**
   * Create an inactive user
   */
  static createInactiveUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      isActive: false,
      ...overrides
    });
  }

  /**
   * Create invalid user data for testing validation
   */
  static createInvalidUserDto(): Partial<CreateUserDto> {
    const invalidOptions = [
      { email: 'invalid-email' }, // Invalid email format
      { email: '' }, // Empty email
      { firstName: '' }, // Empty first name
      { lastName: '' }, // Empty last name
      { password: '123' }, // Too short password
      { password: '' }, // Empty password
    ];

    return faker.helpers.arrayElement(invalidOptions);
  }

  /**
   * Create user with specific test scenario
   */
  static createUserForScenario(scenario: 'new' | 'existing' | 'duplicate' | 'invalid'): TestUser | Partial<CreateUserDto> {
    switch (scenario) {
      case 'new':
        return this.createUser();
      case 'existing':
        return this.createUser({ createdAt: faker.date.past({ years: 1 }) });
      case 'duplicate':
        return this.createUser({ email: 'duplicate@test.com' });
      case 'invalid':
        return this.createInvalidUserDto() as TestUser;
      default:
        return this.createUser();
    }
  }
}
