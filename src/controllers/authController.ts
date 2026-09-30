import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { authService } from '../services/auth/authService';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, role, department } = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, password, and full name are required.' }
      });
      return;
    }

    const result = await authService.register(email, password, fullName, role, department);
    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully.'
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || 'REGISTRATION_FAILED', message: err.message }
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
      });
      return;
    }

    const result = await authService.login(email, password);
    res.json({
      success: true,
      data: result,
      message: 'Logged in successfully.'
    });
  } catch (err: any) {
    res.status(err.status || 401).json({
      success: false,
      error: { code: err.code || 'LOGIN_FAILED', message: err.message }
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' }
      });
      return;
    }

    const user = await authService.getMe(req.user.id);
    res.json({
      success: true,
      data: { user }
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || 'USER_FETCH_ERROR', message: err.message }
    });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
};
