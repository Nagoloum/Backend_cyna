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
      <p>Voici le lien pour réinitialiser votre mot de passe (valable 1 heure, à usage unique) :</p>
      <p><a href="${link}">Réinitialiser votre mot de passe</a></p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Bienvenue invité : un compte a été créé lors d'un achat invité, lien pour
  // définir le mot de passe (valable 7 jours, à usage unique).
  async sendWelcomeSetPassword(email: string, token: string) {
    const link = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Bienvenue sur Cyna — activez votre compte',
      html: `<h1>Votre compte Cyna a été créé</h1>
      <p>Bonjour,</p>
      <p>Suite à votre commande, nous avons créé un compte afin que vous puissiez
      gérer vos abonnements (renouvellement, résiliation) et accéder à vos factures.</p>
      <p>Définissez votre mot de passe pour activer votre accès (lien valable 7 jours) :</p>
      <p><a href="${link}">Définir mon mot de passe</a></p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    });
  }

  // ── Emails transactionnels (commandes / abonnements) ───────────────────────

  private static euro(value: unknown): string {
    return `${Number(value ?? 0).toFixed(2)} €`;
  }

  private static periodeLabel(periode: unknown): string {
    return String(periode) === 'ANNEE' ? 'Annuel' : 'Mensuel';
  }

  // Confirmation de commande payée, avec récapitulatif et décomposition TVA.
  async sendOrderConfirmation(email: string, commande: any) {
    const reference = commande?.reference ?? '';
    const rows = (commande?.abonnements ?? [])
      .map((a: any) => {
        const name = a?.product?.name ?? 'Service';
        const periode = SendEmailService.periodeLabel(a?.periode);
        const qty = a?.quantity ?? 1;
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${periode}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${SendEmailService.euro(a?.price)}</td>
        </tr>`;
      })
      .join('');
    const tvaPercent = Math.round(Number(commande?.tvaRate ?? 0) * 100);
    const accountLink = `${FRONTEND_URL}/account`;

    await this.transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: `Cyna — Confirmation de votre commande ${reference}`,
      html: `<h1>Merci pour votre commande</h1>
      <p>Bonjour,</p>
      <p>Votre paiement a bien été reçu. Voici le récapitulatif de votre commande
      <strong>${reference}</strong> :</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px;font-size:14px">
        <thead>
          <tr style="text-align:left">
            <th style="padding:6px 8px;border-bottom:2px solid #333">Service</th>
            <th style="padding:6px 8px;border-bottom:2px solid #333">Période</th>
            <th style="padding:6px 8px;border-bottom:2px solid #333;text-align:center">Qté</th>
            <th style="padding:6px 8px;border-bottom:2px solid #333;text-align:right">Montant</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="max-width:560px;font-size:14px">
        Sous-total HT : <strong>${SendEmailService.euro(commande?.totalHT)}</strong><br/>
        ${
          Number(commande?.discountAmount) > 0
            ? `Remise${commande?.couponCode ? ` (${commande.couponCode})` : ''} : <strong>- ${SendEmailService.euro(commande?.discountAmount)}</strong><br/>`
            : ''
        }
        TVA (${tvaPercent}%) : <strong>${SendEmailService.euro(commande?.tvaAmount)}</strong><br/>
        Total TTC : <strong>${SendEmailService.euro(commande?.totalPrice)}</strong>
      </p>
      <p>Vous pouvez retrouver vos commandes et télécharger votre facture depuis
      <a href="${accountLink}">votre espace client</a>.</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    });
  }

  // Confirmation de renouvellement d'abonnement.
  async sendRenewalConfirmation(
    email: string,
    info: {
      periode?: unknown;
      amount?: unknown;
      dateFin?: string;
      productName?: string;
    },
  ) {
    const periode = SendEmailService.periodeLabel(info?.periode);
    const dateFin = info?.dateFin
      ? new Date(info.dateFin).toLocaleDateString('fr-FR')
      : null;
    await this.transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Cyna — Votre abonnement a été renouvelé',
      html: `<h1>Renouvellement confirmé</h1>
      <p>Bonjour,</p>
      <p>Votre abonnement${info?.productName ? ` <strong>${info.productName}</strong>` : ''}
      (${periode}) a bien été renouvelé pour un montant de
      <strong>${SendEmailService.euro(info?.amount)}</strong>.</p>
      ${dateFin ? `<p>Nouvelle échéance : <strong>${dateFin}</strong>.</p>` : ''}
      <p>Merci de votre confiance.</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    });
  }

  // Réponse du support à un message de contact.
  async sendContactReply(
    email: string,
    subject: string,
    replyMessage: string,
    originalMessage?: string,
  ) {
    const safeReply = String(replyMessage ?? '').replace(/\n/g, '<br/>');
    await this.transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: `Re: ${subject ?? 'votre message'}`,
      html: `<h1>Réponse du support Cyna</h1>
      <p>Bonjour,</p>
      ${
        originalMessage
          ? `<p>En réponse à votre message :</p>
             <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#666">${originalMessage}</blockquote>`
          : ''
      }
      <p>${safeReply}</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    });
  }

  // Notification d'expiration d'abonnement (échéance atteinte sans renouvellement).
  async sendSubscriptionExpired(email: string) {
    const accountLink = `${FRONTEND_URL}/account`;
    await this.transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Cyna — Votre abonnement a expiré',
      html: `<h1>Votre abonnement a expiré</h1>
      <p>Bonjour,</p>
      <p>Un ou plusieurs de vos abonnements sont arrivés à échéance et n'ont pas
      été renouvelés. L'accès au service correspondant est désormais suspendu.</p>
      <p>Vous pouvez le réactiver à tout moment en le renouvelant depuis
      <a href="${accountLink}">votre espace client</a>.</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    });
  }

  // Confirmation de résiliation d'abonnement.
  async sendCancellationConfirmation(
    email: string,
    info: { periode?: unknown; productName?: string },
  ) {
    const periode = SendEmailService.periodeLabel(info?.periode);
    await this.transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Cyna — Résiliation de votre abonnement',
      html: `<h1>Abonnement résilié</h1>
      <p>Bonjour,</p>
      <p>Votre abonnement${info?.productName ? ` <strong>${info.productName}</strong>` : ''}
      (${periode}) a bien été résilié. Il restera actif jusqu'à la fin de la
      période déjà réglée, puis ne sera plus renouvelé.</p>
      <p>Nous serons ravis de vous revoir.</p>
      <p>Cordialement,<br/>L'équipe Cyna</p>`,
    });
  }
}
