const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper para manejar errores
const handleError = (error, res, message = 'Error en el servidor') => {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
};

// Obtener carrito del usuario
router.get('/', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const userId = req.user.id;
    
    try {
        // Obtener items del carrito
        const { data: cartItems, error } = await supabase
            .from('carrito')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const enrichedItems = [];
        
        for (const item of cartItems) {
            if (item.item_type === 'barra') {
                const { data: barra, error: barraError } = await supabase
                    .from('barras')
                    .select('nombre, imagen')
                    .eq('id', item.item_id)
                    .single();
                
                if (!barraError && barra) {
                    enrichedItems.push({
                        ...item,
                        nombre: barra.nombre,
                        imagen: barra.imagen
                    });
                } else {
                    enrichedItems.push({
                        ...item,
                        nombre: 'Producto no disponible',
                        imagen: null
                    });
                }
            } else if (item.item_type === 'promo') {
                const { data: promo, error: promoError } = await supabase
                    .from('promociones')
                    .select('nombre, imagen')
                    .eq('id', item.item_id)
                    .single();
                
                if (!promoError && promo) {
                    enrichedItems.push({
                        ...item,
                        nombre: promo.nombre,
                        imagen: promo.imagen
                    });
                } else {
                    enrichedItems.push({
                        ...item,
                        nombre: 'Promoción no disponible',
                        imagen: null
                    });
                }
            } else {
                enrichedItems.push(item);
            }
        }
        
        res.json({ success: true, data: enrichedItems });
    } catch (error) {
        handleError(error, res, 'Error obteniendo carrito');
    }
});

// Agregar al carrito
router.post('/add', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const userId = req.user.id;
    const { item_type, item_id, quantity, cantidad_personas, precio_total } = req.body;
    
    try {
        // Buscar si ya existe el mismo item
        let query = supabase
            .from('carrito')
            .select('id, quantity')
            .eq('user_id', userId)
            .eq('item_type', item_type)
            .eq('item_id', item_id);
        
        // Si tiene cantidad_personas, filtrar por ese campo también
        if (cantidad_personas) {
            query = query.eq('cantidad_personas', cantidad_personas);
        } else {
            query = query.is('cantidad_personas', null);
        }
        
        const { data: existing, error: findError } = await query.limit(1);
        
        if (findError) throw findError;
        
        if (existing && existing.length > 0) {
            // Actualizar existente
            const existingItem = existing[0];
            const newQuantity = existingItem.quantity + (quantity || 1);
            const unitPrice = precio_total / (quantity || 1);
            const newTotal = newQuantity * unitPrice;
            
            const { error: updateError } = await supabase
                .from('carrito')
                .update({ 
                    quantity: newQuantity, 
                    precio_total: newTotal 
                })
                .eq('id', existingItem.id);
            
            if (updateError) throw updateError;
        } else {
            // Insertar nuevo
            const { error: insertError } = await supabase
                .from('carrito')
                .insert([{
                    user_id: userId,
                    item_type: item_type,
                    item_id: item_id,
                    quantity: quantity || 1,
                    cantidad_personas: cantidad_personas || null,
                    precio_total: precio_total
                }]);
            
            if (insertError) throw insertError;
        }
        
        res.json({ success: true, message: 'Producto agregado al carrito' });
    } catch (error) {
        handleError(error, res, 'Error agregando al carrito');
    }
});

// Actualizar cantidad
router.put('/update/:id', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const { quantity, precio_total } = req.body;
    const userId = req.user.id;
    
    try {
        const { error } = await supabase
            .from('carrito')
            .update({ quantity, precio_total })
            .eq('id', id)
            .eq('user_id', userId);
        
        if (error) throw error;
        
        // Verificar si se actualizó algún registro
        const { data: check, error: checkError } = await supabase
            .from('carrito')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();
        
        if (checkError || !check) {
            return res.status(404).json({ success: false, message: 'Item no encontrado' });
        }
        
        res.json({ success: true, message: 'Carrito actualizado' });
    } catch (error) {
        handleError(error, res, 'Error actualizando carrito');
    }
});

// Eliminar del carrito
router.delete('/remove/:id', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        const { error } = await supabase
            .from('carrito')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Item eliminado del carrito' });
    } catch (error) {
        handleError(error, res, 'Error eliminando del carrito');
    }
});

// Vaciar carrito
router.delete('/clear', authenticateToken, async (req, res) => {
    const supabase = getDb();
    const userId = req.user.id;
    
    try {
        const { error } = await supabase
            .from('carrito')
            .delete()
            .eq('user_id', userId);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Carrito vaciado' });
    } catch (error) {
        handleError(error, res, 'Error vaciando carrito');
    }
});

module.exports = router;