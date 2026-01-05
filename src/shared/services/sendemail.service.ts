import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';
import * as nodemailer from 'nodemailer';

config();
@Injectable()
export class SendEmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST!,
    port: parseInt(process.env.MAIL_PORT!, 10),
    auth: {
      user: process.env.MAIL_USER!,
      pass: process.env.MAIL_PASSWORD!,
    },
  });

  async sendVerificationCode(email: string, code: string) {
    const mailOptions = {
      from: 'woodpartners@gmail.com',
      to: email,
      subject: 'Verification Code',
      text: `Your verification code is ${code}`,
    };

    await this.transporter.sendMail(mailOptions);
  }
  async sendMailConfirmation(email: string, token: string) {
    const mailOptions = {
      from: 'no-reply@woodpartners.fr',
      to: email,
      subject: 'Bienvenue sur Woodpartners',
      html: `<h1>Bienvenue sur Woodpartners</h1>
      <p>Bonjour,</p>
      <p>Nous sommes ravis de vous accueillir sur notre plateforme.</p>
      <p>Pour finaliser votre inscription, veuillez confirmer votre adresse email:</p>
      <a href="http://localhost:4200/email-confirmation?confirmation=${token}">Cliquer ici pour confirmer votre compte</a>
      <p>Merci de nous avoir choisis !</p>
      <p>Cordialement,</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }
  async confirmedEmail(email: string, token: string) {
    const mailOptions = {
      from: 'no-reply@eduguide.com',
      to: email,
      subject: 'Bienvenue sur EduGuide',
      html: `<h1>Bienvenue sur EduGuide</h1>
      <p>Bonjour ${email},</p>
      <p>Nous sommes ravis de vous accueillir sur notre plateforme.</p>
      <p>Pour finaliser votre inscription, veuillez confirmer votre adresse email:</p>
      <a href="http://localhost:3000/api/auth/email-confirmation?token=${token}">Cliquer ici pour confirmer votre compte</a>
      <p>Merci de nous avoir choisis !</p>
      <p>Cordialement,</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }
  async sendResetPassword(email: string, token: string) {
    const mailOptions = {
      from: 'no-reply@woodpartners.fr',
      to: email,
      subject: 'Reinitialiser votre mot de passe',
      html: `<h1>Reinitialiser votre mot de passe</h1>
      <p>Bonjour,</p>
      <p>Vous avez demandé de reinitialiser votre mot de passe sur notre plateforme.</p>
      <p>Voici le lien pour reinitialiser votre mot de passe :</p>
      <p><a href="http://localhost:4200/change-password?token=${token}">Reinitialiser votre mot de passe</a></p>
     
      <p>Cordialement,</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
