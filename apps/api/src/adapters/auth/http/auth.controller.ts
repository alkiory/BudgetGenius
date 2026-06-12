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
import { SkipThrottle } from '@nestjs/throttler';
import { LoggingService } from '@infrastructure/log/logger.service';
import { ForgotPasswordDto } from '../../../application/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../../application/auth/dto/reset-password.dto';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly logger: LoggingService,
    private readonly cookieService: CookieService,
  ) { }

  @Post('firebase-login')
  @ApiOperation({ summary: 'Autenticar con Firebase' })
  @ApiResponse({ status: 200, description: 'Token verificado y cookies seteadas' })
  async firebaseLogin(
    @Body() body: { idToken: string },
    @Res({ passthrough: true }) res: Response
  ) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(body.idToken);

      const firebaseUser = {
        email: decodedToken.email || decodedToken.firebase?.identities?.email?.[0],
        name: decodedToken.name || 'Username no proporcionado',
      };

      const { accessToken, refreshToken, userEntity } = await this.authService.oauthLogin(firebaseUser);

      this.cookieService.setCookie(res, 'accessToken', accessToken);
      this.cookieService.setCookie(res, 'refreshToken', refreshToken);

      this.logger.log(`🔓 Login con Firebase exitoso para: ${firebaseUser.email}`);

      return {
        message: '🔓 Login successful',
        userEntity
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
        message: '🪪 Successfully signed up and logged in',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Solicitud inválida' })
  @ApiResponse({ status: 401, description: 'Correo electrónico ya en uso' })
  async signup(@Body() signupDTO: CreateUserDto) {
    const existingUser = await this.authService.findOne(signupDTO.email);
    if (existingUser) {
      throw new UnauthorizedException('⚠️ Email already in use');
    }

    const newUser = await this.userService.createUser({
      name: signupDTO.name,
      surname: signupDTO.surname,
      email: signupDTO.email,
      password: signupDTO.password,
      authProvider: 'email',
      role: 'user',
      isPremium: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const userData = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const accessToken = this.jwtService.sign(userData, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(userData, { expiresIn: '7d' });

    this.logger.log(`🪪 Registering new user: ${signupDTO.email}`);

    return {
      accessToken,
      refreshToken,
      message: '🪪 Successfully signed up and logged in',
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
        isPremium: false,
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
    type: LoginDto, description: 'Credenciales de inicio de sesión', examples: {
      valid: {
        summary: 'Credenciales válidas',
        value: {
          email: 'john.doe@example.com',
          password: 'password123'
        }
      }
    }
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
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(body.email, body.password);

    this.cookieService.setCookie(res, 'accessToken', result.accessToken);
    this.cookieService.setCookie(res, 'refreshToken', result.refreshToken);

    return {
      user: result.user,
      message: '🔓 Login successful'
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
        this.logger.error(`Error al añadir token a la blacklist: ${error.message}`);
      }
    }

    this.cookieService.clearCookie(res, 'accessToken');
    this.cookieService.clearCookie(res, 'refreshToken');

    return {
      success: true,
      message: '👋 Successfully logged out'
    };
  }

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
    @Res({ passthrough: true }) res: Response
  ) {
    // Intentar leer de la cookie en lugar del @Body
    const token = req.cookies?.refreshToken;

    if (!token) throw new UnauthorizedException('No refresh token provided');

    try {
      const payload = this.jwtService.verify(token);
      // ... generar nuevo accessToken y setearlo en cookie
      const newAccessToken = this.jwtService.sign({ ...payload }, { expiresIn: '1h' });

      this.cookieService.setCookie(res, 'accessToken', newAccessToken);
      this.cookieService.setCookie(res, 'refreshToken', token);

      return { success: true };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
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
