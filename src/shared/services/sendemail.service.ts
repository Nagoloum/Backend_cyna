import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';
import * as nodemailer from 'nodemailer';

config();

// URLs configurables : en production les liens des emails doivent pointer
// vers le vrai domaine, jamais vers localhost. FRONTEND_URL peut contenir
// plusieurs origines (CORS) séparées par des virgules : la première est
// utilisée pour les liens.
const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');
const MAIL_FROM = process.env.MAIL_FROM ?? 'no-reply@cyna.fr';

@Injectable()
export class SendEmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST!,
    port: Number(process.env.MAIL_PORT ?? 587),
    auth: {
      user: process.env.MAIL_USER!,
      pass: process.env.MAIL_PASSWORD!,
    },
  });

  // NB : ne jamais logger le code ni les tokens transmis par email.
  async sendVerificationCode(email: string, code: string) {
    const mailOptions = {
      from: MAIL_FROM,
      to: email,
      subject: 'Cyna — Votre code de vérification',
      text: `Voici votre code de confirmation : ${code}. Il expire dans 5 minutes.`,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendMailConfirmation(email: string, token: string) {
    const link = `${FRONTEND_URL}/email-confirmation?token=${encodeURIComponent(token)}`;
    const mailOptions = {
      from: MAIL_FROM,
      to: email,
      subject: 'Bienvenue sur Cyna',
      html: `<h1>Bienvenue sur Cyna</h1>
      <p>Bonjour,</p>
      <p>Nous sommes ravis de vous accueillir sur notre plateforme.</p>
      <p>Pour finaliser votre inscription, veuillez confirmer votre adresse email :</p>
      <a href="${link}">Cliquer ici pour confirmer votre compte</a>
      <p>Merci de nous avoir choisis !</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async confirmedEmail(email: string, token: string) {
    const link = `${FRONTEND_URL}/email-confirmation?token=${encodeURIComponent(token)}`;
    const mailOptions = {
      from: MAIL_FROM,
      to: email,
      subject: 'Bienvenue sur Cyna',
      html: `<h1>Bienvenue sur Cyna</h1>
      <p>Bonjour,</p>
      <p>Nous sommes ravis de vous accueillir sur notre plateforme.</p>
      <p>Pour finaliser votre inscription, veuillez confirmer votre adresse email :</p>
      <a href="${link}">Cliquer ici pour confirmer votre compte</a>
      <p>Merci de nous avoir choisis !</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendResetPassword(email: string, token: string) {
    const link = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const mailOptions = {
      from: MAIL_FROM,
      to: email,
      subject: 'Cyna — Réinitialiser votre mot de passe',
      html: `<h1>Réinitialiser votre mot de passe</h1>
      <p>Bonjour,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe sur notre plateforme.</p>
      <p>Voici le lien pour réinitialiser votre mot de passe (valable 24 h) :</p>
      <p><a href="${link}">Réinitialiser votre mot de passe</a></p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
