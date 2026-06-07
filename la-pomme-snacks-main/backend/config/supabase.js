const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERROR: Faltan variables de entorno en Railway');
    console.error('SUPABASE_URL:', supabaseUrl ? '✅ Definida' : '❌ FALTA');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Definida' : '❌ FALTA');
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas');
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Conexión a Supabase configurada');
console.log(`📡 URL: ${supabaseUrl}`);

module.exports = supabase;