import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Cliente público para autenticación y consultas con RLS
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Cliente administrativo para operaciones del servidor que requieran bypass de RLS
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Helper para verificar el estado de conexión con Supabase
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Sube un archivo o fotografía de activo al bucket de Supabase Storage
 */
export async function uploadAssetDocument(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ path: string; url: string | null } | null> {
  if (!supabaseAdmin) {
    console.warn('Supabase no está configurado. No se puede subir archivo adjunto.');
    return null;
  }

  const bucketName = 'sivarstock-assets';
  const filePath = `documents/${Date.now()}_${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Error al subir documento a Supabase Storage:', error);
    return null;
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    url: publicUrlData?.publicUrl || null,
  };
}
