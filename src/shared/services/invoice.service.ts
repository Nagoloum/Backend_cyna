import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

/**
 * Génération de factures PDF en mémoire (Buffer), sans écriture sur disque :
 * indispensable en environnement serverless Vercel (filesystem en lecture
 * seule). Le PDF est produit a la volee a chaque telechargement a partir de la
 * commande, il n'y a donc rien a stocker ni a archiver cote serveur.
 */
@Injectable()
export class InvoiceService {
  private static euro(value: unknown): string {
    return `${Number(value ?? 0).toFixed(2)} EUR`;
  }

  private static periodeLabel(periode: unknown): string {
    return String(periode) === 'ANNEE' ? 'Annuel' : 'Mensuel';
  }

  async buildInvoicePdf(commande: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const reference = commande?.reference ?? '';
    const createdAt = commande?.createdAt
      ? new Date(commande.createdAt).toLocaleDateString('fr-FR')
      : '';
    const statut = commande?.statut ?? '';
    const user = commande?.user ?? {};
    const adresse = commande?.addresseFacturation ?? {};
    const tvaPercent = Math.round(Number(commande?.tvaRate ?? 0) * 100);

    // En-tete
    doc
      .fontSize(22)
      .fillColor('#111')
      .text('CYNA', 50, 50)
      .fontSize(10)
      .fillColor('#666')
      .text('Cybersécurité as a Service', 50, 76);

    doc
      .fontSize(18)
      .fillColor('#111')
      .text('FACTURE', 400, 50, { align: 'right' })
      .fontSize(10)
      .fillColor('#666')
      .text(`N° ${reference}`, 400, 76, { align: 'right' })
      .text(`Date : ${createdAt}`, 400, 90, { align: 'right' })
      .text(`Statut : ${statut}`, 400, 104, { align: 'right' });

    // Adresse de facturation
    doc.moveDown(3);
    const billY = 150;
    doc.fontSize(11).fillColor('#111').text('Facturé à :', 50, billY);
    const fullName = `${adresse?.firstName ?? user?.firstName ?? ''} ${
      adresse?.lastName ?? user?.lastName ?? ''
    }`.trim();
    doc.fontSize(10).fillColor('#444');
    let y = billY + 16;
    if (fullName) {
      doc.text(fullName, 50, y);
      y += 14;
    }
    if (user?.email) {
      doc.text(String(user.email), 50, y);
      y += 14;
    }
    const ligneAdresse = [adresse?.adresse, adresse?.complementAdresse]
      .filter(Boolean)
      .join(', ');
    if (ligneAdresse) {
      doc.text(ligneAdresse, 50, y);
      y += 14;
    }
    const ligneVille = [adresse?.codePostal, adresse?.city, adresse?.region]
      .filter(Boolean)
      .join(' ');
    if (ligneVille) {
      doc.text(ligneVille, 50, y);
      y += 14;
    }
    if (adresse?.country) {
      doc.text(String(adresse.country), 50, y);
      y += 14;
    }

    // Tableau des lignes
    const tableTop = Math.max(y + 20, 250);
    doc.fontSize(10).fillColor('#111');
    doc.text('Service', 50, tableTop);
    doc.text('Période', 250, tableTop);
    doc.text('Qté', 360, tableTop, { width: 40, align: 'right' });
    doc.text('Montant', 450, tableTop, { width: 95, align: 'right' });
    doc
      .moveTo(50, tableTop + 16)
      .lineTo(545, tableTop + 16)
      .strokeColor('#ccc')
      .stroke();

    let rowY = tableTop + 24;
    const abonnements: any[] = commande?.abonnements ?? [];
    for (const a of abonnements) {
      const name = a?.product?.name ?? 'Service';
      doc.fillColor('#444').fontSize(10);
      doc.text(String(name), 50, rowY, { width: 195 });
      doc.text(InvoiceService.periodeLabel(a?.periode), 250, rowY);
      doc.text(String(a?.quantity ?? 1), 360, rowY, { width: 40, align: 'right' });
      doc.text(InvoiceService.euro(a?.price), 450, rowY, {
        width: 95,
        align: 'right',
      });
      rowY += 22;
    }

    // Totaux
    doc
      .moveTo(300, rowY + 6)
      .lineTo(545, rowY + 6)
      .strokeColor('#ccc')
      .stroke();
    let totalsY = rowY + 16;
    const totalLine = (label: string, value: string, bold = false) => {
      doc
        .fillColor(bold ? '#111' : '#444')
        .fontSize(bold ? 12 : 10)
        .text(label, 300, totalsY, { width: 150, align: 'right' })
        .text(value, 450, totalsY, { width: 95, align: 'right' });
      totalsY += bold ? 22 : 18;
    };
    totalLine('Sous-total HT', InvoiceService.euro(commande?.totalHT));
    if (Number(commande?.discountAmount) > 0) {
      const label = commande?.couponCode
        ? `Remise (${commande.couponCode})`
        : 'Remise';
      totalLine(label, `- ${InvoiceService.euro(commande?.discountAmount)}`);
    }
    totalLine(`TVA (${tvaPercent}%)`, InvoiceService.euro(commande?.tvaAmount));
    totalLine('Total TTC', InvoiceService.euro(commande?.totalPrice), true);

    // Pied de page
    doc
      .fontSize(8)
      .fillColor('#999')
      .text(
        'Cyna — Facture générée automatiquement. Pour toute question, contactez le support depuis votre espace client.',
        50,
        780,
        { align: 'center', width: 495 },
      );

    doc.end();
    return done;
  }
}
