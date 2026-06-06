const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// Helper para manejar errores
const handleError = (error, res, message = 'Error en el servidor') => {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
};

// Obtener todas las barras
router.get('/barras', async (req, res) => {
    const supabase = getDb();
    
    try {
        // Obtener barras activas
        const { data: barras, error: barrasError } = await supabase
            .from('barras')
            .select('*')
            .eq('active', 1);
        
        if (barrasError) throw barrasError;
        
        // Para cada barra, obtener sus precios e ingredientes
        for (const barra of barras) {
            // Obtener precios
            const { data: precios, error: preciosError } = await supabase
                .from('precios_barra')
                .select('personas, precio')
                .eq('barra_id', barra.id)
                .order('personas');
            
            if (!preciosError) {
                barra.precios = precios;
            } else {
                barra.precios = [];
            }
            
            // Obtener ingredientes
            const { data: ingredientes, error: ingredientesError } = await supabase
                .from('ingredientes')
                .select('nombre')
                .eq('barra_id', barra.id);
            
            if (!ingredientesError) {
                barra.ingredientes = ingredientes.map(i => i.nombre);
            } else {
                barra.ingredientes = [];
            }
        }
        
        res.json({ success: true, data: barras });
    } catch (error) {
        handleError(error, res, 'Error obteniendo barras');
    }
});

// Obtener barra por ID
router.get('/barras/:id', async (req, res) => {
    const supabase = getDb();
    const { id } = req.params;
    
    try {
        // Obtener barra específica
        const { data: barra, error: barraError } = await supabase
            .from('barras')
            .select('*')
            .eq('id', id)
            .eq('active', 1)
            .single();
        
        if (barraError || !barra) {
            return res.status(404).json({ success: false, message: 'Barra no encontrada' });
        }
        
        // Obtener precios
        const { data: precios, error: preciosError } = await supabase
            .from('precios_barra')
            .select('personas, precio')
            .eq('barra_id', id)
            .order('personas');
        
        if (!preciosError) {
            barra.precios = precios;
        } else {
            barra.precios = [];
        }
        
        // Obtener ingredientes
        const { data: ingredientes, error: ingredientesError } = await supabase
            .from('ingredientes')
            .select('nombre')
            .eq('barra_id', id);
        
        if (!ingredientesError) {
            barra.ingredientes = ingredientes.map(i => i.nombre);
        } else {
            barra.ingredientes = [];
        }
        
        res.json({ success: true, data: barra });
    } catch (error) {
        handleError(error, res, 'Error obteniendo barra');
    }
});

// Obtener precio específico
router.get('/precio/:barraId/:personas', async (req, res) => {
    const supabase = getDb();
    const { barraId, personas } = req.params;
    
    try {
        const { data: precio, error } = await supabase
            .from('precios_barra')
            .select('precio')
            .eq('barra_id', barraId)
            .eq('personas', parseInt(personas))
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }
        
        res.json({ success: true, precio: precio ? precio.precio : null });
    } catch (error) {
        handleError(error, res, 'Error obteniendo precio');
    }
});

// Obtener promociones
router.get('/promociones', async (req, res) => {
    const supabase = getDb();
    
    try {
        const { data: promociones, error } = await supabase
            .from('promociones')
            .select('*')
            .eq('active', 1);
        
        if (error) throw error;
        
        res.json({ success: true, data: promociones });
    } catch (error) {
        handleError(error, res, 'Error obteniendo promociones');
    }
});

module.exports = router;