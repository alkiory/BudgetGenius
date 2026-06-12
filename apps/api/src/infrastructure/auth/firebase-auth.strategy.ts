// src/auth/firebase-auth.middleware.ts
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthMiddleware implements NestMiddleware {
  constructor(
    @Inject('FIREBASE_ADMIN') private readonly firebaseAdmin: admin.app.App,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const idToken = req.body.idToken;
    if (!idToken) {
      return res.status(401).json({ message: '🔥 Token no proporcionado' });
    }

    try {
      const decodedToken = await this.firebaseAdmin
        .auth()
        .verifyIdToken(idToken);
      req.user = decodedToken; // Añade el usuario al request
      next();
    } catch (error) {
      console.error('Error al verificar token:', error);
      res.status(401).json({ message: 'Token inválido' });
    }
  }
}
