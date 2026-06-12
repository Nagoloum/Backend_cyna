import { CouponsService } from './coupons.service';
import { CouponType } from './entities/coupon.entity';

// Construit un service avec un couponModel.findOne(...).exec() qui renvoie le
// coupon fourni (ou null).
const serviceWithCoupon = (coupon: any): CouponsService => {
  const model: any = {
    findOne: () => ({ exec: async () => coupon }),
  };
  return new CouponsService(model);
};

const baseCoupon = {
  code: 'WELCOME10',
  type: CouponType.PERCENT,
  value: 10,
  active: true,
  maxUsage: 0,
  usedCount: 0,
  minAmount: 0,
};

describe('CouponsService.validateCode', () => {
  it('calcule une remise en pourcentage', async () => {
    const s = serviceWithCoupon({ ...baseCoupon });
    const r = await s.validateCode('welcome10', 100);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(10);
    expect(r.code).toBe('WELCOME10');
  });

  it('calcule une remise fixe plafonnée au montant', async () => {
    const s = serviceWithCoupon({ ...baseCoupon, type: CouponType.FIXED, value: 50 });
    expect((await s.validateCode('X', 100)).discount).toBe(50);
    // Plafonnée : remise jamais supérieure au montant.
    expect((await s.validateCode('X', 30)).discount).toBe(30);
  });

  it('refuse un code inexistant', async () => {
    const s = serviceWithCoupon(null);
    const r = await s.validateCode('NOPE', 100);
    expect(r.valid).toBe(false);
  });

  it('refuse un code inactif', async () => {
    const s = serviceWithCoupon({ ...baseCoupon, active: false });
    expect((await s.validateCode('X', 100)).valid).toBe(false);
  });

  it('refuse un code expiré', async () => {
    const s = serviceWithCoupon({ ...baseCoupon, endsAt: '2000-01-01T00:00:00.000Z' });
    expect((await s.validateCode('X', 100)).valid).toBe(false);
  });

  it("refuse quand la limite d'utilisation est atteinte", async () => {
    const s = serviceWithCoupon({ ...baseCoupon, maxUsage: 5, usedCount: 5 });
    expect((await s.validateCode('X', 100)).valid).toBe(false);
  });

  it('refuse sous le montant minimum', async () => {
    const s = serviceWithCoupon({ ...baseCoupon, minAmount: 200 });
    expect((await s.validateCode('X', 100)).valid).toBe(false);
  });
});
