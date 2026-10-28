// Las dos variables públicas que necesitan ambos clientes de Supabase.
// Se leen con el nombre completo (process.env.NEXT_PUBLIC_...) porque Next
// solo incrusta en el navegador las que aparecen escritas así, literalmente.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !clave) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copia ../.env.example a web/.env.local y complétalo.",
  );
}

export const supabaseUrl = url;
export const supabaseClave = clave;
