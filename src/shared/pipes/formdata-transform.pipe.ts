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
    if (metadata.type !== 'body' || !value || typeof value !== 'object') {
      return value;
    }

    const normalized = this.normalizeFormData(value);

    return normalized;
  }

  private normalizeFormData(body: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};

    for (const [key, val] of Object.entries(body)) {
      // Cas spécial : abonnements
      if (key === 'abonnements') {
        // 1) Si ça arrive en string JSON : "[{...}]" ou "{...}"
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              out[key] = parsed.map((item) => this.normalizeValue(item));
            } else {
              out[key] = [this.normalizeValue(parsed)];
            }
            continue;
          } catch {
            // si ce n'est pas un JSON valide, on laisse passer plus bas
          }
        }

        // 2) Si ça arrive en objet simple : { ... }
        if (!Array.isArray(val) && typeof val === 'object') {
          out[key] = [this.normalizeValue(val)];
          continue;
        }

        // 3) Si c’est déjà un tableau → on normalise chaque élément
        if (Array.isArray(val)) {
          out[key] = val.map((item) => this.normalizeValue(item));
          continue;
        }

        // 4) Autres cas bizarres : on laisse tel quel (la validation échouera, ce qui est normal)
        out[key] = val;
        continue;
      }

      // Cas général pour les autres champs
      out[key] = this.normalizeValue(val);
    }

    return out;
  }

  private normalizeValue(val: any): any {
    // 1. null / undefined
    if (val === undefined || val === null) {
      return val;
    }

    // 2. Tableaux : on applique la normalisation à chaque élément
    if (Array.isArray(val)) {
      return val.map((item) => this.normalizeValue(item));
    }

    // 3. Objets : on applique la normalisation récursive
    if (typeof val === 'object') {
      const nestedOut: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        nestedOut[k] = this.normalizeValue(v);
      }
      return nestedOut;
    }

    // À partir d’ici, on est sûr d’être sur un type primitif (string, number, boolean)

    // 4. Chaines vides
    if (typeof val === 'string' && val.trim() === '') {
      return undefined;
    }

    const trimmedVal = typeof val === 'string' ? val.trim() : val;

    // 5. Booleans
    if (typeof trimmedVal === 'string') {
      const lower = trimmedVal.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        return lower === 'true';
      }
    }

    // 6. Nombres (sans toucher aux ObjectId Mongo)
    if (
      typeof trimmedVal === 'string' &&
      trimmedVal !== '' &&
      !isNaN(Number(trimmedVal)) &&
      !/^[0-9a-fA-F]{24}$/.test(trimmedVal)
    ) {
      return Number(trimmedVal);
    }

    // 7. JSON (string qui commence par [ ou { )
    if (
      typeof trimmedVal === 'string' &&
      (trimmedVal.startsWith('[') || trimmedVal.startsWith('{'))
    ) {
      try {
        const parsed = JSON.parse(trimmedVal);
        // on normalise aussi le résultat parsé
        return this.normalizeValue(parsed);
      } catch {
        // on laisse la string brute si JSON.parse échoue
        return val;
      }
    }

    // 8. Valeur inchangée
    return val;
  }
}
