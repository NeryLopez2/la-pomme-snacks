const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const twilio = require('twilio');

const router = express.Router();

// ==================== CONFIGURACIÓN ====================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ==================== USAR VARIABLES DE ENTORNO (SEGURAS) ====================
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+14155238886';
const empresaWhatsapp = process.env.EMPRESA_WHATSAPP || '+529381770841';

// Verificar si Twilio está configurado
let twilioClient = null;
if (accountSid && authToken) {
    twilioClient = new twilio(accountSid, authToken);
    console.log('✅ Twilio configurado correctamente');
} else {
    console.log('⚠️ Twilio no configurado. Las notificaciones de WhatsApp no funcionarán.');
    console.log('   Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en variables de entorno');
}

// Datos bancarios
const BANK = {
    name: "Banamex, el abono inicial minimo es de la mitad del total del pedido",
    account: "5256 7861 8824 8391",
    clabe: "0020 5290 5281 9164 88"
};

// ==================== FUNCIÓN PARA ENVIAR MENSAJE ====================
async function enviarWhatsAppTexto(numero, mensaje) {
    if (!twilioClient) {
        console.log('⚠️ Twilio no disponible, no se envió mensaje');
        console.log('📝 Mensaje que se habría enviado:');
        console.log(mensaje);
        return false;
    }
    
    try {
        let num = numero.toString().replace(/\D/g, '');
        if (!num.startsWith('52')) num = '52' + num;
        const destino = `whatsapp:+${num}`;
        const origen = `whatsapp:${twilioNumber}`;
        
        console.log(`📤 Enviando a: ${destino}`);
        
        const result = await twilioClient.messages.create({
            from: origen,
            to: destino,
            body: mensaje
        });
        
        console.log(`✅ Mensaje enviado! SID: ${result.sid}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        return false;
    }
}

// Helper para manejar errores
const handleError = (error, res, message = 'Error en el servidor') => {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
};

// ==================== CREAR PEDIDO ====================
router.post('/create', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const userId = req.user.id;
    const { total, fecha_servicio, hora_servicio, comprobante, phoneNumber } = req.body;
    
    try {
        console.log('\n🆕 NUEVO PEDIDO RECIBIDO');
        
        // Validar fecha mínima (48 horas)
        const selectedDate = new Date(fecha_servicio);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + 2);
        
        if (selectedDate < minDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'Los servicios requieren al menos 48 horas de anticipación' 
            });
        }
        
        // Obtener carrito
        const { data: cartItems, error: cartError } = await supabase
            .from('carrito')
            .select('*')
            .eq('user_id', userId);
        
        if (cartError) throw cartError;
        
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Carrito vacío' });
        }
        
        // Obtener usuario
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (userError) throw userError;
        
        const user = users;
        let telefonoCliente = phoneNumber || user.phone;
        
        if (!telefonoCliente) {
            return res.status(400).json({ success: false, message: 'Número de teléfono requerido' });
        }
        
        console.log(`👤 Cliente: ${user.username} (${telefonoCliente})`);
        console.log(`💰 Total: $${total}`);
        console.log(`📅 Servicio: ${fecha_servicio} ${hora_servicio || ''}`);
        
        // Guardar comprobante
        let comprobantePath = null;
        
        if (comprobante && comprobante.startsWith('data:image')) {
            const matches = comprobante.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const extension = matches[1];
                const base64Data = matches[2];
                const filename = `comprobante_${Date.now()}_${user.username}.${extension}`;
                const comprobantesDir = path.join(__dirname, '../../public/comprobantes');
                
                if (!fs.existsSync(comprobantesDir)) {
                    fs.mkdirSync(comprobantesDir, { recursive: true });
                }
                
                const filepath = path.join(comprobantesDir, filename);
                fs.writeFileSync(filepath, base64Data, 'base64');
                comprobantePath = `/comprobantes/${filename}`;
                console.log(`📎 Comprobante guardado: ${comprobantePath}`);
            }
        }
        
        // Crear pedido
        const { data: newPedido, error: insertError } = await supabase
            .from('pedidos')
            .insert([{
                user_id: userId,
                total: total,
                fecha_servicio: fecha_servicio,
                hora_servicio: hora_servicio || null,
                comprobante: comprobantePath,
                status: 'pendiente'
            }])
            .select();
        
        if (insertError) throw insertError;
        
        const pedidoId = newPedido[0].id;
        console.log(`📋 Pedido #${pedidoId} creado`);
        
        // Agregar detalles
        const productosList = [];
        
        for (const item of cartItems) {
            let itemName = '';
            if (item.item_type === 'barra') {
                const { data: barra, error: barraError } = await supabase
                    .from('barras')
                    .select('nombre')
                    .eq('id', item.item_id)
                    .single();
                
                if (!barraError && barra) {
                    itemName = barra.nombre;
                } else {
                    itemName = 'Barra';
                }
            } else {
                const { data: promo, error: promoError } = await supabase
                    .from('promociones')
                    .select('nombre')
                    .eq('id', item.item_id)
                    .single();
                
                if (!promoError && promo) {
                    itemName = promo.nombre;
                } else {
                    itemName = 'Promoción';
                }
            }
            
            const unitPrice = item.precio_total / item.quantity;
            
            const { error: detError } = await supabase
                .from('pedido_detalles')
                .insert([{
                    pedido_id: pedidoId,
                    item_type: item.item_type,
                    item_name: itemName,
                    cantidad_personas: item.cantidad_personas || null,
                    quantity: item.quantity,
                    precio_unitario: unitPrice,
                    subtotal: item.precio_total
                }]);
            
            if (detError) throw detError;
            
            productosList.push({
                nombre: itemName,
                cantidad_personas: item.cantidad_personas,
                quantity: item.quantity,
                subtotal: item.precio_total
            });
        }
        
        const fechaFormateada = new Date(fecha_servicio).toLocaleDateString('es-MX', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Construir texto de productos
        let productosTexto = productosList.map((p, i) => {
            if (p.cantidad_personas) {
                return `┃  ${i+1}️⃣  *${p.nombre}* (${p.cantidad_personas} personas)\n┃     💰 $${p.subtotal.toFixed(2)} MXN`;
            } else {
                return `┃  ${i+1}️⃣  *${p.nombre}* x${p.quantity}\n┃     💰 $${p.subtotal.toFixed(2)} MXN`;
            }
        }).join('\n');
        
        // ==================== MENSAJE PARA EL DUEÑO ====================
        const mensajeDueño = `🍎 *LA POMME SNACKS* 🍎
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛎️ *¡NUEVO PEDIDO RECIBIDO!* 🛎️
━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Pedido #${pedidoId}*
━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *CLIENTE*
┃  🧑 ${user.username}
┃  📧 ${user.email || 'No registrado'}
┃  📞 ${telefonoCliente}

📅 *SERVICIO*
┃  🗓️ ${fechaFormateada}
${hora_servicio ? `┃  ⏰ ${hora_servicio}` : ''}

💰 *TOTAL*
┃  💵 $${total.toFixed(2)} MXN

📦 *PRODUCTOS SOLICITADOS*
${productosTexto}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📎 *COMPROBANTE DE PAGO*
┃  👀 *Ve el recibo en el panel de administrador*
┃  📍 Sección: *PEDIDOS* > Pedido #${pedidoId}
━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ *Gracias por usar La Pomme Snacks!* ✨`;

        // ==================== ENVIAR AL DUEÑO ====================
        console.log('\n📤 Enviando mensaje al DUEÑO...');
        await enviarWhatsAppTexto(empresaWhatsapp, mensajeDueño);
        
        // Vaciar carrito
        const { error: clearError } = await supabase
            .from('carrito')
            .delete()
            .eq('user_id', userId);
        
        if (clearError) throw clearError;
        
        console.log(`\n✅ Pedido #${pedidoId} completado exitosamente\n`);
        
        // ==================== RESPUESTA AL CLIENTE ====================
        res.json({ 
            success: true, 
            message: '✅ Pedido enviado correctamente. Puedes ver el estado en "Mis Pedidos".',
            pedidoId
        });
        
    } catch (error) {
        console.error('❌ Error al crear pedido:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== OBTENER MIS PEDIDOS ====================
router.get('/my-orders', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const userId = req.user.id;
    
    try {
        // Obtener pedidos del usuario
        const { data: orders, error: ordersError } = await supabase
            .from('pedidos')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;
        
        // Obtener detalles de cada pedido
        for (const order of orders) {
            const { data: details, error: detailsError } = await supabase
                .from('pedido_detalles')
                .select('*')
                .eq('pedido_id', order.id);
            
            if (!detailsError) {
                order.detalles = details;
            } else {
                order.detalles = [];
            }
        }
        
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error('Error en my-orders:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== OBTENER PEDIDO ESPECÍFICO ====================
router.get('/:id', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        // Obtener pedido
        const { data: order, error: orderError } = await supabase
            .from('pedidos')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();
        
        if (orderError || !order) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
        }
        
        // Obtener detalles
        const { data: details, error: detailsError } = await supabase
            .from('pedido_detalles')
            .select('*')
            .eq('pedido_id', id);
        
        if (!detailsError) {
            order.detalles = details;
        } else {
            order.detalles = [];
        }
        
        res.json({ success: true, data: order });
    } catch (error) {
        handleError(error, res, 'Error obteniendo pedido');
    }
});

module.exports = router;
