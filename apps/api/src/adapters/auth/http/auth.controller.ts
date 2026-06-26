import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '@application/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@application/user/user.service';
import { CreateUserDto } from '@application/user/dto/create.dto';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { SkipThrottle, Throttle, hours } from '@nestjs/throttler';
import { LoggingService } from '@infrastructure/log/logger.service';
import { ForgotPasswordDto } from '../../../application/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../../application/auth/dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginDto } from '@application/auth/dto/login.dto';
import { CookieService } from '@infrastructure/config/cookie.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@domain/user/user.entity';

/** 7 días en milisegundos — coincide con el JWT expiry del refreshToken. */
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly logger: LoggingService,
    private readonly cookieService: CookieService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Iniciar OAuth con Google (redirect)' })
  async googleAuth() {
    // AuthGuard('google') handles the redirect to Google's OAuth page.
    // This endpoint never reaches the handler body — the guard sends a 302.
  }

  @Get('google-callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  async googleCallback(@Req() req, @Res() res: Response) {
    try {
      const user = req.user as User;

      const { accessToken, refreshToken, userEntity } =
        await this.authService.oauthLogin({
          email: user.email,
          name: user.name || user.email,
        });

      this.cookieService.setCookie(res, 'accessToken', accessToken);
      this.cookieService.setCookie(res, 'refreshToken', refreshToken, {
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });

      this.logger.log(`🔓 Google OAuth exitoso para: ${user.email}`);

      // Redirect to custom scheme for Capacitor app.
      // Tokens are passed in the URL so the Capacitor WebView can set them
      // as cookies (the httpOnly cookies set here belong to the Chrome
      // Custom Tab's cookie jar, not the WebView).
      //
      // Instead of raw HTTP 302 (which Chrome Custom Tabs may not forward
      // to the intent filter reliably), return a minimal HTML page that
      // uses JavaScript to trigger the custom-scheme redirect.  The
      // client-side `window.location.replace()` reliably triggers Android's
      // intent resolution for the `bgg://` scheme, which hands off to the
      // Capacitor app through the intent filter in AndroidManifest.xml.
      const redirectUrl = `bgg://auth/success?accessToken=${encodeURIComponent(
        accessToken,
      )}&refreshToken=${encodeURIComponent(refreshToken)}`;
      return res.status(200).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Redirecting to BudgetGenius…</title>
<meta http-equiv="refresh" content="0;url=${redirectUrl
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}">
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  p { font-size: 1.1rem; opacity: 0.8; }
</style>
</head>
<body>
<p>Redirecting back to BudgetGenius…</p>
<script>window.location.replace('${redirectUrl}');</script>
</body>
</html>`);
    } catch (error) {
      this.logger.error(`🚨 Falló el OAuth de Google: ${error.message}`);
      const fallbackUrl =
        this.configService.get<string>('NODE_ENV') === 'production'
          ? 'https://budgetgeniusia.web.app'
          : 'http://localhost:5173';
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL')?.split(',')[0]?.trim() ||
        fallbackUrl;
      return res.redirect(
        301,
        `${frontendUrl}/auth/login?error=google_auth_failed`,
      );
    }
  }

  @Post('firebase-login')
  @ApiOperation({ summary: 'Autenticar con Firebase' })
  @ApiResponse({
    status: 200,
    description: 'Token verificado y cookies seteadas',
  })
  async firebaseLogin(
    @Body() body: { idToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(body.idToken);

      const firebaseUser = {
        email:
          decodedToken.email || decodedToken.firebase?.identities?.email?.[0],
        name: decodedToken.name || 'Username no proporcionado',
      };

      const { accessToken, refreshToken, userEntity } =
        await this.authService.oauthLogin(firebaseUser);

      this.cookieService.setCookie(res, 'accessToken', accessToken);
      this.cookieService.setCookie(res, 'refreshToken', refreshToken, {
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });

      this.logger.log(
        `🔓 Login con Firebase exitoso para: ${firebaseUser.email}`,
      );

      return {
        message: '🔓 Login successful',
        userEntity,
      };
    } catch (error) {
      this.logger.error(`🚨 Falló el login con Firebase: ${error.message}`);
      throw new UnauthorizedException('Token inválido');
    }
  }

  @Post('signup')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado y autenticado exitosamente',
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        user: {
          id: 1,
          name: 'Sergio',
          email: 'sergio@example.com',
          role: 'user',
        },
        isNewUser: true,
        message: '🪪 Successfully signed up and logged in',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Solicitud inválida' })
  @ApiResponse({
    status: 409,
    description:
      'El correo ya está registrado. Si coincide con tu contraseña, se inicia sesión (idempotente); si no, devuelve conflicto.',
  })
  async signup(
    @Body() signupDTO: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user, isNewUser } =
      await this.authService.signup({
        name: signupDTO.name,
        surname: signupDTO.surname,
        email: signupDTO.email,
        password: signupDTO.password,
        authProvider: signupDTO.authProvider ?? 'email',
        role: signupDTO.role ?? 'user',
      });

    this.cookieService.setCookie(res, 'accessToken', accessToken);
    this.cookieService.setCookie(res, 'refreshToken', refreshToken, {
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    if (isNewUser) {
      this.logger.log(`🪪 Registering new user: ${signupDTO.email}`);
    }

    return {
      accessToken,
      refreshToken,
      user,
      isNewUser,
      message: isNewUser
        ? '🪪 Successfully signed up and logged in'
        : '🔓 Login successful (existing account)',
    };
  }

  @Get(':email')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener información de un usuario por correo electrónico',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del usuario obtenida exitosamente',
    schema: {
      example: {
        id: 1,
        name: 'John',
        surname: 'Doe',
        email: 'john.doe@example.com',
        role: 'user',
        isPremium: true,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('email') email: string) {
    return this.authService.findOne(email);
  }

  @Post('login')
  @ApiOperation({ summary: 'Autenticar un usuario' })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciales de inicio de sesión',
    examples: {
      valid: {
        summary: 'Credenciales válidas',
        value: {
          email: 'john.doe@example.com',
          password: 'password123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario autenticado exitosamente',
    schema: {
      example: {
        message: '🔓 Login successful',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);

    this.cookieService.setCookie(res, 'accessToken', result.accessToken);
    this.cookieService.setCookie(res, 'refreshToken', result.refreshToken, {
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return {
      user: result.user,
      message: '🔓 Login successful',
    };
  }

  @SkipThrottle()
  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.accessToken;

    if (token) {
      try {
        await this.authService.addTokenToBlacklist(token);
      } catch (error) {
        this.logger.error(
          `Error al añadir token a la blacklist: ${error.message}`,
        );
      }

      // Also invalidate the refresh token in Redis so a stale cookie
      // (e.g. in a Capacitor WebView where cookie clearing may not
      // propagate immediately) cannot be used to silently re-auth.
      try {
        const userData = this.jwtService.decode(token);
        if (userData && userData['id']) {
          await this.authService.invalidateRefreshToken(userData['id']);
        }
      } catch (error) {
        this.logger.warn(
          `Could not invalidate refresh token during logout: ${error.message}`,
        );
      }
    }

    this.cookieService.clearCookie(res, 'accessToken');
    this.cookieService.clearCookie(res, 'refreshToken');

    return {
      success: true,
      message: '👋 Successfully logged out',
    };
  }

  /**
   * Per-IP rate cap for the password-reset flow.
   *
   * Why a per-route override and not a second configured throttler in
   * `ThrottlerModule.forRoot()`: each entry in that array applies
   * APP_GUARD-wide, so adding a "forgot-password" named throttler there
   * would silently subject every endpoint to the same hour-scale cap.
   * The `default` override on this route replaces ONLY the global
   * 4-rps rule for `/auth/forgot-password`, with a stricter bucket
   * aimed at the Resend free-tier daily-cap threat (an attacker
   * hammering this endpoint to drain ~100 sends/day from
   * `onboarding@resend.dev`).
   *
   * Limit: 5 successes per IP per hour. Allows a few legitimate
   * retries (typo, refresh, recovering client's "resend" button
   * jitter) while forcing an attacker to rotate through 20+ IPs to
   * exhaust the daily delivery cap.
   *
   * The ResendMailerService counters still increment per send, so
   * ops sees real Resend API cost pressure independent of this
   * IP-side cap.
   *
   * Note: the route-level override REPLACES the global 4/10s for this
   * path. That is the user-visible intent of "separate from the
   * global limiter".
   */
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Intentar leer de la cookie en lugar del @Body
    const token = req.cookies?.refreshToken;

    if (!token) throw new UnauthorizedException('No refresh token provided');

    try {
      const payload = this.jwtService.verify(token);

      // Check Redis to ensure the refresh token hasn't been revoked
      // (e.g. by a logout that deleted it from Redis).
      const userId = payload['id'] || payload['sub'];
      await this.authService.refreshToken(userId, token);

      // ... generar nuevo accessToken y setearlo en cookie
      const newAccessToken = this.jwtService.sign(
        { ...payload },
        { expiresIn: '1h' },
      );

      this.cookieService.setCookie(res, 'accessToken', newAccessToken);
      this.cookieService.setCookie(res, 'refreshToken', token, {
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });

      return { success: true };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Post('set-cookies')
  @ApiOperation({
    summary: 'Establecer cookies JWT desde el WebView de Capacitor',
  })
  @ApiResponse({ status: 200, description: 'Cookies seteadas correctamente' })
  async setCookies(
    @Body() body: { accessToken: string; refreshToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.accessToken || !body.refreshToken) {
      throw new UnauthorizedException(
        'Access token and refresh token are required',
      );
    }

    this.cookieService.setCookie(res, 'accessToken', body.accessToken);
    this.cookieService.setCookie(res, 'refreshToken', body.refreshToken, {
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return { success: true, message: 'Cookies set successfully' };
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req) {
    return {
      isValid: true,
      user: req.user,
    };
  }
}
