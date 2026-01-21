import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from 'dotenv';
import { User } from 'src/features/users/entities/user.entity';
import { StringValue } from 'ms';

config();

@Injectable()
export class SharedService {
  constructor(private jwtService: JwtService) {}

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

    return  this.jwtService.sign(payload, {
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
}
