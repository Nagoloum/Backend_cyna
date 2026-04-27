import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from 'dotenv';
import { User } from 'src/features/users/entities/user.entity';
import { StringValue } from 'ms';

config();

@Injectable()
export class SharedService {
  constructor(private jwtService: JwtService) {}

  private storedCode: string | null = null;
  private expiry: number | null = null;

  generateSlug(name: string): string {
    // Convertir en minuscules et supprimer les caractères spéciaux et les accents
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      // Remplacer les espaces par des tirets
      .replace(/\s+/g, '-');

    return slug;
  }
  generateLicenseKey(groupsCount: number = 4, groupLength: number = 4): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const groups: string[] = [];

    for (let i = 0; i < groupsCount; i++) {
      let group = '';
      for (let j = 0; j < groupLength; j++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        group += chars[randomIndex];
      }
      groups.push(group);
    }

    return groups.join('-');
  }

  generateReference(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }

    return result; // exemple: "a9Zk2P0xQ1"
  }

  accessToken(user: User) {
    const payload = {
      id: user._id.toString(), // ✅ important
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET_KEY!,
      expiresIn: process.env.ACCESS_TOKEN_EXPIRE_TIME as StringValue,
    });
  }
  tokenConfirmedEmail(user: User) {
    const payload = {
      id: user._id.toString(), // ✅ important
      email: user.email,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET_KEY!,
      expiresIn: '24h' as StringValue,
    });
  }
  isStrongPassword(password: string): boolean {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    return regex.test(password);
  }

  confirmationToken(user: User) {
    const payload = {
      id: user._id.toString(), // ✅ important
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET_KEY!,
      expiresIn: process.env.ACCESS_TOKEN_EXPIRE_TIME as StringValue,
    });
  }
  /** Valide, charge et retourne les ObjectId associés à une liste d’IDs string. */

  parseDate(dateStr: string) {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day); // mois commence à 0 en JS
  }

  generateSixDigitCode(): string {
    const newVerificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    this.storedCode = newVerificationCode;
    this.expiry = Date.now() + 5 * 60 * 1000; // Valide 5 minutes
    return newVerificationCode;
  }
  verifyCode(code: string): boolean {
    if (!this.storedCode || !this.expiry) {
      return false;
    }
    // Étape 2 : Vérification du temps
    if (Date.now() > this.expiry) {
      this.storedCode = null; // on efface le code en memoire
      return false;
    }
    const isMatch = code === this.storedCode;
    return isMatch;
  }
}
