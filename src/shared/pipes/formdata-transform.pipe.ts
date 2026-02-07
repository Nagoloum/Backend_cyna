// src/common/pipes/formdata-transform.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
/**
 * Pipe pour transformer les données FormData AVANT la validation.
 * Convertit automatiquement :
 * - Strings JSON → Objects/Arrays
 * - "true"/"false" → boolean
 * - Nombres en string → number
 */
@Injectable()
export class FormDataTransformPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Ne traite que les objets (le body)
    if (metadata.type !== 'body' || !value || typeof value !== 'object') {
      return value;
    }
    return this.normalizeFormData(value);
  }

  private normalizeFormData(body: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};

    for (const [key, val] of Object.entries(body)) {
      // 1. Gestion des valeurs nulles ou vides
      if (val === undefined || val === null) {
        out[key] = val;
        continue;
      }

      if (typeof val === 'string' && val.trim() === '') {
        out[key] = undefined;
        continue;
      }

      // On prépare une version nettoyée pour les tests suivants
      const trimmedVal = typeof val === 'string' ? val.trim() : val;

      // 2. Booleans (plus robuste avec toLowerCase)
      if (typeof trimmedVal === 'string') {
        const lower = trimmedVal.toLowerCase();
        if (lower === 'true' || lower === 'false') {
          out[key] = lower === 'true';
          continue;
        }
      }

      // 3. Nombres (Entiers et Flottants en une seule fois)
      // On vérifie si la string est un nombre valide et n'est pas un MongoID (longue string hex)
      if (
        typeof trimmedVal === 'string' &&
        trimmedVal !== '' &&
        !isNaN(Number(trimmedVal)) &&
        !/^[0-9a-fA-F]{24}$/.test(trimmedVal) // Évite de transformer les IDs MongoDB en nombres
      ) {
        out[key] = Number(trimmedVal);
        continue;
      }

      // 4. JSON (Tableaux et Objets)
      if (
        typeof trimmedVal === 'string' &&
        (trimmedVal.startsWith('[') || trimmedVal.startsWith('{'))
      ) {
        try {
          out[key] = JSON.parse(trimmedVal);
          continue;
        } catch (err) {
          // En cas d'erreur, on laisse la string brute
        }
      }

      // 5. Valeur par défaut
      out[key] = val;
    }

    return out;
  }
}
