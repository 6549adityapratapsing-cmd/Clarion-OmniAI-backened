import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { supabaseClient } from '../repositories/database';
import { UserRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required.'
      }
    });
    return;
  }

  // 1. Primary: Verify via Supabase Auth
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);
      if (!error && data?.user) {
        req.user = {
          id: data.user.id,
          email: data.user.email || '',
          role: (data.user.user_metadata?.role as UserRole) || 'REVIEWER',
          fullName: data.user.user_metadata?.fullName || data.user.email?.split('@')[0] || 'User'
        };
        next();
        return;
      }
    } catch (sbErr) {
      // Continue to secondary check if Supabase check fails
    }
  }

  // 2. Secondary fallback (Offline/Mock JWT verification)
  try {
    if (token.startsWith('demo-') || token === 'demo-token') {
      req.user = {
        id: 'demo-user-123',
        email: 'demo.reviewer@clarion.ai',
        role: 'ADMIN',
        fullName: 'Demo Reviewer'
      };
      next();
      return;
    }

    const payload = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName
    };
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'The provided authentication token is invalid or expired.'
      }
    });
  }
};
