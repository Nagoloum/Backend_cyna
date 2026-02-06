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
      // Valeur vide → undefined
      if (typeof val === 'string' && val.trim() === '') {
        out[key] = undefined;
        continue;
      }
      if (val === undefined || val === null) {
        out[key] = val;
        continue;
      }
      // Boolean strings
      if (val === 'true' || val === 'false') {
        out[key] = val === 'true';
        continue;
      }
      // Integer
      if (typeof val === 'string' && /^[+-]?\d+$/.test(val)) {
        out[key] = parseInt(val, 10);
        continue;
      }
      // Float
      if (typeof val === 'string' && /^[+-]?\d*\.\d+$/.test(val)) {
        out[key] = parseFloat(val);
        continue;
      }
      // JSON strings (arrays/objects)
      if (
        typeof val === 'string' &&
        (val.startsWith('[') || val.startsWith('{'))
      ) {
        try {
          out[key] = JSON.parse(val);
          continue;
        } catch (err) {
          // Si parse échoue, garde la string
        }
      }
      // Garde la valeur originale
      out[key] = val;
    }
    return out;
  }
}
