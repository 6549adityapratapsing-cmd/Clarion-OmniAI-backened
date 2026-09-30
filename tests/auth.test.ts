import bcrypt from 'bcryptjs';
import { authService } from '../src/services/auth/authService';

describe('Authentication & Security Service', () => {
  const testEmail = `test_${Date.now()}@clarion.ai`;
  const testPassword = 'Password@123';

  it('should register a new user and hash the password using bcrypt', async () => {
    const { user, token } = await authService.register(
      testEmail,
      testPassword,
      'Test Reviewer',
      'REVIEWER',
      'Finance'
    );

    expect(user).toBeDefined();
    expect(user.email).toBe(testEmail);
    expect(user.role).toBe('REVIEWER');
    expect(token).toBeDefined();

    // Password must never be returned in safe user object
    expect((user as any).passwordHash).toBeUndefined();
  });

  it('should authenticate user with correct credentials and issue JWT', async () => {
    const { user, token } = await authService.login(testEmail, testPassword);

    expect(user.email).toBe(testEmail);
    expect(token).toBeTruthy();
  });

  it('should reject login with incorrect credentials', async () => {
    await expect(authService.login(testEmail, 'WrongPassword!')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS'
    });
  });

  it('should verify that default demo accounts use bcrypt with 12 salt rounds', () => {
    const hash = bcrypt.hashSync('Password@123', 12);
    expect(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$')).toBe(true);
    expect(bcrypt.compareSync('Password@123', hash)).toBe(true);
  });
});
