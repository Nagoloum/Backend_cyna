import { SetMetadata } from '@nestjs/common';

// Marque les routes accessibles avec un jeton "pre-auth" 2FA (login non encore
// valide par le second facteur) : uniquement les endpoints de verification du
// code 2FA. Toute autre route protegee refuse un tel jeton (voir AuthGuard).
export const ALLOW_2FA_PENDING = 'allow_2fa_pending';
export const Allow2FAPending = () => SetMetadata(ALLOW_2FA_PENDING, true);
