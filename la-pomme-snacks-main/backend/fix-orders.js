const { initializeDatabase, getDb } = require('./db');

async function fixOrders() {
    await initializeDatabase();
    const supabase = getDb();
    
    console.log('\n🔧 REPARANDO PEDIDOS EXISTENTES\n');
    
    // Obtener todos los pedidos
    const { data: pedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .order('id', { ascending: true });
    
    if (pedidosError) {
        console.error('❌ Error obteniendo pedidos:', pedidosError);
        process.exit(1);
    }
    
    if (!pedidos || pedidos.length === 0) {
        console.log('📭 No hay pedidos en la base de datos.');
        process.exit();
    }
    
    console.log(`📦 Encontrados ${pedidos.length} pedido(s)\n`);
    
    let reparados = 0;
    let yaTienen = 0;
    
    for (const pedido of pedidos) {
        // Verificar si ya tiene detalles
        const { data: detalles, error: detallesError } = await supabase
            .from('pedido_detalles')
            .select('*')
            .eq('pedido_id', pedido.id);
        
        if (detallesError) {
            console.error(`❌ Error verificando detalles del pedido ${pedido.id}:`, detallesError);
            continue;
        }
        
        if (!detalles || detalles.length === 0) {
            console.log(`📝 Reparando pedido #${pedido.id}...`);
            
            // Crear un detalle genérico basado en el total
            const { error: insertError } = await supabase
                .from('pedido_detalles')
                .insert([{
                    pedido_id: pedido.id,
                    item_type: 'barra',
                    item_name: 'Producto (consulta con el administrador)',
                    cantidad_personas: null,
                    quantity: 1,
                    precio_unitario: pedido.total,
                    subtotal: pedido.total
                }]);
            
            if (insertError) {
                console.error(`   ❌ Error reparando pedido ${pedido.id}:`, insertError);
            } else {
                console.log(`   ✅ Reparado con item genérico ($${pedido.total})`);
                reparados++;
            }
        } else {
            console.log(`✅ Pedido #${pedido.id} ya tiene ${detalles.length} detalle(s)`);
            yaTienen++;
        }
    }
    
    console.log('\n📊 RESUMEN:');
    console.log(`   - Pedidos reparados: ${reparados}`);
    console.log(`   - Pedidos con detalles: ${yaTienen}`);
    console.log(`   - Total pedidos: ${pedidos.length}`);
    console.log('\n✅ REPARACIÓN COMPLETADA\n');
    
    if (reparados > 0) {
        console.log('🔄 Reinicia el servidor y prueba la página "Mis Pedidos"');
    }
    
    process.exit();
}

fixOrders();