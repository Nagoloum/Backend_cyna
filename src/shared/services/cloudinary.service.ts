import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, ConfigOptions } from 'cloudinary';

/**
 * Service d'upload d'images vers Cloudinary.
 *
 * Remplace le stockage sur disque local (`fs.writeFileSync` dans `./storage/...`),
 * qui ne fonctionne pas sur un hébergement serverless (Vercel) où le système de
 * fichiers est en lecture seule et éphémère.
 *
 * Configuration via variables d'environnement :
 *   - CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *   (ou bien CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    // Si CLOUDINARY_URL est défini, le SDK le lit automatiquement.
    const config: ConfigOptions = { secure: true };
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      config.cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
      config.api_key = process.env.CLOUDINARY_API_KEY;
      config.api_secret = process.env.CLOUDINARY_API_SECRET;
    }
    cloudinary.config(config);
  }

  /**
   * Envoie un buffer d'image vers Cloudinary et renvoie l'URL HTTPS publique.
   *
   * @param buffer  contenu du fichier (Express.Multer.File.buffer)
   */
  async uploadBuffer(buffer: Buffer): Promise<string> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          // Ni dossier ni public_id : Cloudinary génère un identifiant unique
          // et aléatoire lui-même, à la racine.
          resource_type: 'image',
        },
        (error, uploaded) => {
          if (error && error instanceof Error) {
            return reject(
              new Error(`Upload Cloudinary échoué: ${error.message}`),
            );
          }
          if (!uploaded) {
            return reject(new Error('Upload Cloudinary échoué'));
          }
          resolve(uploaded);
        },
      );
      stream.end(buffer);
    });

    return result.secure_url;
  }

  /**
   * Supprime une image sur Cloudinary à partir de son URL stockée en base.
   * Ne lève jamais d'erreur : un échec de suppression ne doit pas bloquer le flux
   * métier (le document est déjà supprimé/mis à jour en base).
   * Ignore silencieusement les URLs qui ne sont pas des URLs Cloudinary
   * (anciennes images locales `storage/...`).
   */
  async deleteByUrl(url?: string | null): Promise<void> {
    const publicId = this.extractPublicId(url);
    if (!publicId) return;

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
      this.logger.warn(
        `Suppression Cloudinary impossible pour ${publicId}: ${String(error)}`,
      );
    }
  }

  /**
   * Extrait le public_id (incluant le dossier, sans extension ni version) d'une
   * URL Cloudinary. Renvoie null si l'URL n'est pas une URL Cloudinary.
   *
   * Ex: https://res.cloudinary.com/demo/image/upload/v1700000000/cyna/products/prod-123.jpg
   *  -> cyna/products/prod-123
   */
  private extractPublicId(url?: string | null): string | null {
    if (!url || !url.includes('res.cloudinary.com')) return null;

    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return null;

    // Retire l'extension du fichier
    return match[1].replace(/\.[^/.]+$/, '');
  }
}
