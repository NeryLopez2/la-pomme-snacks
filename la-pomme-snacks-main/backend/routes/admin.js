const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(isAdmin);

// Helper para manejar errores de Supabase
const handleError = (error, res, message = 'Error en el servidor') => {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
};

// Dashboard stats
router.get('/stats', async (req, res) => {
    const supabase = getDb();
    
    try {
        // Contar usuarios normales (role = 'user')
        const { count: totalUsers, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'user');
        
        if (usersError) throw usersError;
        
        // Contar pedidos totales
        const { count: totalOrders, error: ordersError } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true });
        
        if (ordersError) throw ordersError;
        
        // Sumar ingresos de pedidos pagados
        const { data: revenueData, error: revenueError } = await supabase
            .from('pedidos')
            .select('total')
            .eq('status', 'pagado');
        
        if (revenueError) throw revenueError;
        
        const totalRevenue = revenueData?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
        
        // Contar pedidos pendientes
        const { count: pendingOrders, error: pendingError } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendiente');
        
        if (pendingError) throw pendingError;
        
        res.json({
            success: true,
            data: {
                users: totalUsers || 0,
                orders: totalOrders || 0,
                revenue: totalRevenue,
                pending: pendingOrders || 0
            }
        });
    } catch (error) {
        handleError(error, res, 'Error obteniendo estadísticas');
    }
});

// ==================== ESTADÍSTICAS PARA GRÁFICAS ====================

// Ventas por mes (últimos 12 meses)
router.get('/stats/ventas-mensuales', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select('created_at, total')
            .in('status', ['pagado', 'completado'])
            .order('created_at', { ascending: false })
            .limit(1000);
        
        if (error) throw error;
        
        // Agrupar por mes manualmente (Supabase no tiene strftime como SQLite)
        const ventasPorMes = {};
        const ahora = new Date();
        
        for (let i = 0; i < 12; i++) {
            const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            ventasPorMes[mesKey] = { total_pedidos: 0, ingresos: 0 };
        }
        
        for (const pedido of pedidos) {
            const fecha = new Date(pedido.created_at);
            const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            if (ventasPorMes[mesKey]) {
                ventasPorMes[mesKey].total_pedidos++;
                ventasPorMes[mesKey].ingresos += pedido.total || 0;
            }
        }
        
        const ventas = Object.entries(ventasPorMes).map(([mes, data]) => ({
            mes,
            total_pedidos: data.total_pedidos,
            ingresos: data.ingresos
        })).sort((a, b) => a.mes.localeCompare(b.mes));
        
        res.json({ success: true, data: ventas });
    } catch (error) {
        handleError(error, res, 'Error obteniendo ventas mensuales');
    }
});

// Productos más vendidos (top 10)
router.get('/stats/productos-top', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: detalles, error } = await supabase
            .from('pedido_detalles')
            .select('item_name, quantity, pedido_id, subtotal');
        
        if (error) throw error;
        
        // Agrupar por nombre de producto
        const productosMap = {};
        for (const item of detalles) {
            if (!productosMap[item.item_name]) {
                productosMap[item.item_name] = {
                    nombre: item.item_name,
                    cantidad_vendida: 0,
                    numero_pedidos: new Set(),
                    ingresos: 0
                };
            }
            productosMap[item.item_name].cantidad_vendida += item.quantity || 1;
            productosMap[item.item_name].numero_pedidos.add(item.pedido_id);
            productosMap[item.item_name].ingresos += item.subtotal || 0;
        }
        
        const productos = Object.values(productosMap).map(p => ({
            nombre: p.nombre,
            cantidad_vendida: p.cantidad_vendida,
            numero_pedidos: p.numero_pedidos.size,
            ingresos: p.ingresos
        })).sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
          .slice(0, 10);
        
        res.json({ success: true, data: productos });
    } catch (error) {
        handleError(error, res, 'Error obteniendo productos top');
    }
});

// Pedidos por estado
router.get('/stats/pedidos-estado', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: estados, error } = await supabase
            .from('pedidos')
            .select('status');
        
        if (error) throw error;
        
        // Contar por estado
        const conteo = {};
        for (const pedido of estados) {
            conteo[pedido.status] = (conteo[pedido.status] || 0) + 1;
        }
        
        const estadoMap = {
            'pendiente': '📝 Pendiente',
            'pagado': '✅ Pagado',
            'completado': '🎉 Completado',
            'cancelado': '❌ Cancelado'
        };
        
        const data = Object.entries(conteo).map(([status, cantidad]) => ({
            estado: estadoMap[status] || status,
            cantidad
        }));
        
        res.json({ success: true, data });
    } catch (error) {
        handleError(error, res, 'Error obteniendo pedidos por estado');
    }
});

// Ingresos por día (últimos 30 días)
router.get('/stats/ingresos-diarios', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select('created_at, total')
            .in('status', ['pagado', 'completado']);
        
        if (error) throw error;
        
        // Filtrar últimos 30 días
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        
        const ingresosPorDia = {};
        
        for (const pedido of pedidos) {
            const fecha = new Date(pedido.created_at);
            if (fecha >= hace30Dias) {
                const diaKey = fecha.toISOString().split('T')[0];
                if (!ingresosPorDia[diaKey]) {
                    ingresosPorDia[diaKey] = { pedidos: 0, ingresos: 0 };
                }
                ingresosPorDia[diaKey].pedidos++;
                ingresosPorDia[diaKey].ingresos += pedido.total || 0;
            }
        }
        
        const ingresos = Object.entries(ingresosPorDia)
            .map(([dia, data]) => ({
                dia,
                pedidos: data.pedidos,
                ingresos: data.ingresos
            }))
            .sort((a, b) => a.dia.localeCompare(b.dia));
        
        res.json({ success: true, data: ingresos });
    } catch (error) {
        handleError(error, res, 'Error obteniendo ingresos diarios');
    }
});

// ==================== CRUD BARRAS ====================
router.get('/barras', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: barras, error } = await supabase
            .from('barras')
            .select('*')
            .order('id');
        
        if (error) throw error;
        res.json({ success: true, data: barras });
    } catch (error) {
        handleError(error, res, 'Error obteniendo barras');
    }
});

router.post('/barras', async (req, res) => {
    const supabase = getDb();
    const { nombre, descripcion, categoria, imagen } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('barras')
            .insert([{ nombre, descripcion, categoria, imagen }])
            .select();
        
        if (error) throw error;
        res.json({ success: true, id: data[0].id });
    } catch (error) {
        handleError(error, res, 'Error creando barra');
    }
});

router.put('/barras/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const { nombre, descripcion, categoria, imagen, active } = req.body;
    
    try {
        const { error } = await supabase
            .from('barras')
            .update({ nombre, descripcion, categoria, imagen, active })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error actualizando barra');
    }
});

router.delete('/barras/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        const { error } = await supabase
            .from('barras')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error eliminando barra');
    }
});

// ==================== PRECIOS DE BARRAS ====================
router.get('/barras/:id/precios', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        const { data: precios, error } = await supabase
            .from('precios_barra')
            .select('personas, precio')
            .eq('barra_id', id)
            .order('personas');
        
        if (error) throw error;
        res.json({ success: true, data: precios });
    } catch (error) {
        handleError(error, res, 'Error obteniendo precios');
    }
});

router.put('/barras/:id/precios', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const { precios } = req.body;
    
    try {
        // Eliminar precios existentes
        const { error: deleteError } = await supabase
            .from('precios_barra')
            .delete()
            .eq('barra_id', id);
        
        if (deleteError) throw deleteError;
        
        // Insertar nuevos precios
        for (const item of precios) {
            if (item.precio && item.precio > 0) {
                const { error: insertError } = await supabase
                    .from('precios_barra')
                    .insert([{
                        barra_id: id,
                        personas: item.personas,
                        precio: item.precio
                    }]);
                
                if (insertError) throw insertError;
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error actualizando precios');
    }
});

// ==================== INGREDIENTES DE BARRAS ====================
router.get('/barras/:id/ingredientes', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        const { data: ingredientes, error } = await supabase
            .from('ingredientes')
            .select('id, nombre')
            .eq('barra_id', id);
        
        if (error) throw error;
        res.json({ success: true, data: ingredientes });
    } catch (error) {
        handleError(error, res, 'Error obteniendo ingredientes');
    }
});

router.put('/barras/:id/ingredientes', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const { ingredientes } = req.body;
    
    try {
        // Eliminar ingredientes existentes
        const { error: deleteError } = await supabase
            .from('ingredientes')
            .delete()
            .eq('barra_id', id);
        
        if (deleteError) throw deleteError;
        
        // Insertar nuevos ingredientes
        for (const nombre of ingredientes) {
            if (nombre && nombre.trim()) {
                const { error: insertError } = await supabase
                    .from('ingredientes')
                    .insert([{
                        barra_id: id,
                        nombre: nombre.trim()
                    }]);
                
                if (insertError) throw insertError;
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error actualizando ingredientes');
    }
});

// ==================== CRUD PROMOCIONES ====================
router.get('/promociones', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: promociones, error } = await supabase
            .from('promociones')
            .select('*')
            .order('id');
        
        if (error) throw error;
        res.json({ success: true, data: promociones });
    } catch (error) {
        handleError(error, res, 'Error obteniendo promociones');
    }
});

router.post('/promociones', async (req, res) => {
    const supabase = getDb();
    const { nombre, descripcion, precio, precio_anterior, badge, imagen } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('promociones')
            .insert([{ nombre, descripcion, precio, precio_anterior, badge, imagen }])
            .select();
        
        if (error) throw error;
        res.json({ success: true, id: data[0].id });
    } catch (error) {
        handleError(error, res, 'Error creando promoción');
    }
});

router.put('/promociones/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const { nombre, descripcion, precio, precio_anterior, badge, imagen, active } = req.body;
    
    try {
        const { error } = await supabase
            .from('promociones')
            .update({ nombre, descripcion, precio, precio_anterior, badge, imagen, active })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error actualizando promoción');
    }
});

router.delete('/promociones/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        const { error } = await supabase
            .from('promociones')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error eliminando promoción');
    }
});

// ==================== GESTIÓN DE PEDIDOS ====================
router.get('/pedidos', async (req, res) => {
    const supabase = getDb();
    
    try {
        // Obtener pedidos con información de usuario
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                users:user_id (id, username, email, phone)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Obtener detalles de cada pedido
        for (const pedido of pedidos) {
            const { data: detalles, error: detError } = await supabase
                .from('pedido_detalles')
                .select('*')
                .eq('pedido_id', pedido.id);
            
            if (!detError) {
                pedido.detalles = detalles;
            } else {
                pedido.detalles = [];
            }
        }
        
        // Formatear la respuesta
        const formattedPedidos = pedidos.map(p => ({
            ...p,
            user_id: p.user_id,
            username: p.users?.username,
            email: p.users?.email,
            phone: p.users?.phone
        }));
        
        res.json({ success: true, data: formattedPedidos });
    } catch (error) {
        handleError(error, res, 'Error obteniendo pedidos');
    }
});

router.put('/pedidos/:id/status', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        const { error } = await supabase
            .from('pedidos')
            .update({ status })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error actualizando estado');
    }
});

router.delete('/pedidos/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        // Primero eliminar detalles (CASCADE debería hacerlo, pero por seguridad)
        const { error: detError } = await supabase
            .from('pedido_detalles')
            .delete()
            .eq('pedido_id', id);
        
        if (detError) throw detError;
        
        // Luego eliminar el pedido
        const { error } = await supabase
            .from('pedidos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error eliminando pedido');
    }
});

// ==================== GESTIÓN DE USUARIOS ====================
router.get('/usuarios', async (req, res) => {
    const supabase = getDb();
    
    try {
        // Obtener usuarios con conteo de pedidos
        const { data: usuarios, error } = await supabase
            .from('users')
            .select(`
                id,
                username,
                email,
                phone,
                role,
                created_at,
                pedidos (id)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const usuariosFormateados = usuarios.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            phone: u.phone,
            role: u.role,
            created_at: u.created_at,
            pedidos_count: u.pedidos?.length || 0
        }));
        
        res.json({ success: true, data: usuariosFormateados });
    } catch (error) {
        handleError(error, res, 'Error obteniendo usuarios');
    }
});

router.delete('/usuarios/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        // Verificar que no sea admin
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('id', id)
            .single();
        
        if (user?.role === 'admin') {
            return res.status(403).json({ success: false, message: 'No se puede eliminar al administrador' });
        }
        
        // Eliminar carrito
        await supabase.from('carrito').delete().eq('user_id', id);
        
        // Eliminar detalles de pedidos
        const { data: pedidos } = await supabase
            .from('pedidos')
            .select('id')
            .eq('user_id', id);
        
        if (pedidos && pedidos.length > 0) {
            const pedidosIds = pedidos.map(p => p.id);
            await supabase.from('pedido_detalles').delete().in('pedido_id', pedidosIds);
            await supabase.from('pedidos').delete().eq('user_id', id);
        }
        
        // Eliminar usuario
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleError(error, res, 'Error eliminando usuario');
    }
});

module.exports = router;