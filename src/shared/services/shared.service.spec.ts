import { JwtService } from '@nestjs/jwt';
import { SharedService } from './shared.service';

describe('SharedService', () => {
  const secret = 'test-secret-key';
  let jwt: JwtService;
  let service: SharedService;

  beforeAll(() => {
    process.env.ACCESS_TOKEN_SECRET_KEY = secret;
    process.env.ACCESS_TOKEN_EXPIRE_TIME = '1h';
    jwt = new JwtService();
    service = new SharedService(jwt);
  });

  // Faux utilisateur minimal (le service ne lit que _id/email/role).
  const fakeUser: any = {
    _id: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    role: 'CUSTOMER',
  };

  describe('isStrongPassword', () => {
    it('accepte un mot de passe fort', () => {
      expect(service.isStrongPassword('Abcdef1@')).toBe(true);
    });
    it('rejette les mots de passe faibles', () => {
      expect(service.isStrongPassword('short1@')).toBe(false); // < 8
      expect(service.isStrongPassword('alllowercase1@')).toBe(false); // pas de majuscule
      expect(service.isStrongPassword('ALLUPPERCASE1@')).toBe(false); // pas de minuscule
      expect(service.isStrongPassword('NoDigits@@')).toBe(false); // pas de chiffre
      expect(service.isStrongPassword('NoSpecial11')).toBe(false); // pas de spécial
    });
  });

  describe('accessToken', () => {
    it('émet un jeton complet sans flag twoFactorPending par défaut', () => {
      const token = service.accessToken(fakeUser);
      const payload: any = jwt.verify(token, { secret });
      expect(payload.id).toBe(fakeUser._id);
      expect(payload.email).toBe(fakeUser.email);
      expect(payload.role).toBe(fakeUser.role);
      expect(payload.twoFactorPending).toBeUndefined();
    });

    it('ajoute twoFactorPending quand la 2FA est requise (jeton pre-auth)', () => {
      const token = service.accessToken(fakeUser, { twoFactorPending: true });
      const payload: any = jwt.verify(token, { secret });
      expect(payload.twoFactorPending).toBe(true);
    });
  });

  describe('resetPasswordToken', () => {
    it('encode le jti et le purpose reset', () => {
      const token = service.resetPasswordToken(fakeUser, 'jti-123');
      const payload: any = jwt.verify(token, { secret });
      expect(payload.jti).toBe('jti-123');
      expect(payload.purpose).toBe('reset');
      expect(payload.email).toBe(fakeUser.email);
    });
  });

  describe('générateurs', () => {
    it('generateSlug normalise accents, espaces et casse', () => {
      expect(service.generateSlug('Cyber Sécurité Pro')).toBe('cyber-securite-pro');
    });
    it('generateReference renvoie 10 caractères alphanumériques', () => {
      expect(service.generateReference()).toMatch(/^[A-Za-z0-9]{10}$/);
    });
    it('generateLicenseKey renvoie 4 groupes de 4 caractères', () => {
      expect(service.generateLicenseKey()).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
    });
    it('generateSixDigitCode renvoie 6 chiffres', () => {
      expect(service.generateSixDigitCode()).toMatch(/^\d{6}$/);
    });
  });
});
