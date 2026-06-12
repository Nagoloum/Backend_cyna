import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  const service = new InvoiceService();

  const commande: any = {
    reference: 'ABC1234567',
    createdAt: '2026-06-12T10:00:00.000Z',
    statut: 'PAID',
    totalHT: 100,
    tvaRate: 0.2,
    tvaAmount: 20,
    totalPrice: 120,
    user: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' },
    addresseFacturation: {
      firstName: 'Jean',
      lastName: 'Dupont',
      adresse: '1 rue de la Paix',
      city: 'Paris',
      codePostal: '75001',
      country: 'France',
    },
    abonnements: [
      { product: { name: 'SOC Managé' }, periode: 'MOIS', quantity: 2, price: 100 },
    ],
  };

  it('génère un Buffer PDF non vide', async () => {
    const pdf = await service.buildInvoicePdf(commande);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(500);
    // Un fichier PDF commence par l'en-tête "%PDF".
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('ne lève pas d’erreur sur une commande aux champs manquants', async () => {
    const pdf = await service.buildInvoicePdf({ reference: 'X', abonnements: [] });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});
