import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { supabaseClient, supabaseAnonClient } from '../../repositories/database';
import { dataStore } from '../../repositories/dataStore';
import { User, UserRole } from '../../types';

export class AuthService {
  /**
   * Register a new user.
   * Primary authentication authority: Supabase Auth.
   * Supabase Auth manages password hashing and credentials; no passwords are stored in application state.
   */
  async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'REVIEWER',
    department?: string
  ): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      throw {
        status: 400,
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long.'
      };
    }

    // 1. Primary: Register through Supabase Auth
    if (supabaseClient && supabaseAnonClient) {
      try {
        const { data: adminData, error: adminError } = await supabaseClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            fullName: fullName.trim(),
            role,
            department: department?.trim()
          }
        });

        if (adminError) {
          if (adminError.message.includes('already registered') || adminError.message.includes('already exists')) {
            throw {
              status: 400,
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'An account with this email address already exists.'
            };
          }
          throw {
            status: 400,
            code: 'AUTH_REGISTRATION_FAILED',
            message: adminError.message
          };
        }

        // Sign in immediately to acquire valid session token
        const { data: signInData, error: signInError } = await supabaseAnonClient.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        if (signInError || !signInData.session) {
          throw {
            status: 500,
            code: 'SESSION_INITIALIZATION_FAILED',
            message: signInError?.message || 'Failed to initialize session after registration.'
          };
        }

        const safeUser: Omit<User, 'passwordHash'> = {
          id: adminData.user.id,
          email: normalizedEmail,
          fullName: fullName.trim(),
          role,
          department: department?.trim(),
          isActive: true,
          createdAt: adminData.user.created_at,
          updatedAt: new Date().toISOString()
        };

        // Cache in memory for quick relational reference (WITHOUT passwords)
        dataStore.users.set(safeUser.id, { ...safeUser });

        dataStore.auditLogs.push({
          id: uuidv4(),
          userId: safeUser.id,
          action: 'USER_REGISTERED',
          entityType: 'USER',
          entityId: safeUser.id,
          metadata: { role: safeUser.role, email: safeUser.email, provider: 'SUPABASE_AUTH' },
          createdAt: new Date().toISOString()
        });

        return { user: safeUser, token: signInData.session.access_token };
      } catch (err: any) {
        if (err.status) throw err;
        console.warn('⚠️ Supabase registration encountered error, checking fallback:', err);
      }
    }

    // 2. Offline / Standalone Mock Fallback
    // Architectural Note: bcrypt is only used here when Supabase Auth is unreachable
    // to allow self-contained local testing without third-party network dependencies.
    for (const u of dataStore.users.values()) {
      if (u.email.toLowerCase() === normalizedEmail) {
        throw {
          status: 400,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.'
        };
      }
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const newUser: User = {
      id: uuidv4(),
      email: normalizedEmail,
      passwordHash,
      fullName: fullName.trim(),
      role,
      department: department?.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.users.set(newUser.id, newUser);
    const token = this.generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;

    return { user: safeUser, token };
  }

  /**
   * Log in an existing user.
   * Primary authentication authority: Supabase Auth.
   */
  async login(
    email: string,
    password: string
  ): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Primary: Verify via Supabase Auth
    if (supabaseAnonClient) {
      try {
        const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        if (!error && data?.user && data?.session) {
          const safeUser: Omit<User, 'passwordHash'> = {
            id: data.user.id,
            email: normalizedEmail,
            fullName: data.user.user_metadata?.fullName || normalizedEmail.split('@')[0],
            role: (data.user.user_metadata?.role as UserRole) || 'REVIEWER',
            department: data.user.user_metadata?.department,
            isActive: true,
            createdAt: data.user.created_at,
            updatedAt: new Date().toISOString()
          };

          // Cache in memory for quick document ownership lookups
          dataStore.users.set(safeUser.id, { ...safeUser });

          dataStore.auditLogs.push({
            id: uuidv4(),
            userId: safeUser.id,
            action: 'USER_LOGIN',
            entityType: 'USER',
            entityId: safeUser.id,
            metadata: { email: safeUser.email, role: safeUser.role, provider: 'SUPABASE_AUTH' },
            createdAt: new Date().toISOString()
          });

          return { user: safeUser, token: data.session.access_token };
        }
      } catch (sbErr) {
        console.warn('⚠️ Supabase sign in error, checking local fallback:', sbErr);
      }
    }

    // 2. Offline / Standalone Mock Fallback
    // Architectural Note: bcrypt is only used here when Supabase Auth is unreachable
    let user: User | null = null;
    for (const u of dataStore.users.values()) {
      if (u.email.toLowerCase() === normalizedEmail) {
        user = u;
        break;
      }
    }

    if (!user || !user.passwordHash) {
      throw {
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.'
      };
    }

    if (!user.isActive) {
      throw {
        status: 403,
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact an administrator.'
      };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw {
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.'
      };
    }

    const token = this.generateToken(user);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, token };
  }

  async getUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    // 1. Try Supabase Auth
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.auth.admin.getUserById(id);
        if (!error && data?.user) {
          return {
            id: data.user.id,
            email: data.user.email || '',
            fullName: data.user.user_metadata?.fullName || 'User',
            role: (data.user.user_metadata?.role as UserRole) || 'REVIEWER',
            department: data.user.user_metadata?.department,
            isActive: true,
            createdAt: data.user.created_at,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        // Fallback to in-memory store
      }
    }

    // 2. Try in-memory store
    const user = dataStore.users.get(id);
    if (!user) return null;

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async getMe(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    return this.getUserById(id);
  }

  /**
   * Generate an immediate signed bypass mock session for demo/hackathon evaluations.
   */
  generateMockAuth(email: string, role?: UserRole): { user: Omit<User, 'passwordHash'>; token: string } {
    const normalizedEmail = (email || 'demo.user@clarion.ai').trim().toLowerCase();

    let userRole: UserRole = role || 'ADMIN';
    if (normalizedEmail.includes('viewer')) {
      userRole = 'VIEWER';
    } else if (normalizedEmail.includes('reviewer') || normalizedEmail.includes('student')) {
      userRole = 'REVIEWER';
    }

    const namePart = normalizedEmail.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName =
      namePart.length > 1
        ? namePart.replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Demo Reviewer';

    const mockUser: Omit<User, 'passwordHash'> = {
      id: `demo-${uuidv4()}`,
      email: normalizedEmail,
      fullName: formattedName,
      role: userRole,
      department: 'Procurement & Finance Audit',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Cache in dataStore so all subsequent protected queries (reviews, approvals, documents) succeed
    dataStore.users.set(mockUser.id, { ...mockUser });

    const token = jwt.sign(
      {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        fullName: mockUser.fullName
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return { user: mockUser, token };
  }

  private generateToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
  }
}

export const authService = new AuthService();
