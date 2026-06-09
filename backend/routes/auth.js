const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = 'la-pomme-secret-key-2026';

// Función para validar y formatear número de teléfono mexicano
function validateAndFormatPhone(phone) {
    if (!phone || phone.trim() === '') {
        return null;
    }
    
    // Limpiar el número: eliminar espacios, guiones, etc.
    let cleanPhone = phone.toString().replace(/[\s\-\(\)]/g, '');
    
    // Si ya tiene +52 al inicio, mantenerlo
    if (cleanPhone.startsWith('+52')) {
        cleanPhone = cleanPhone.substring(1); // Quitar el + para guardar
        if (/^52\d{10}$/.test(cleanPhone)) {
            return cleanPhone;
        }
    }
    
    // Si ya tiene 52 al inicio (sin +)
    if (cleanPhone.startsWith('52') && /^52\d{10}$/.test(cleanPhone)) {
        return cleanPhone;
    }
    
    // Si son 10 dígitos, agregar 52
    if (/^\d{10}$/.test(cleanPhone)) {
        return '52' + cleanPhone;
    }
    
    // Formato inválido
    return null;
}

// Registro con validación de teléfono mexicano
router.post('/register', async (req, res) => {
    const { username, email, phone, password } = req.body;
    const supabase = getDb();
    
    // Validar teléfono (obligatorio)
    if (!phone || phone.trim() === '') {
        return res.status(400).json({ 
            success: false, 
            message: 'El número de teléfono es requerido' 
        });
    }
    
    // Validar y formatear teléfono con +52
    const formattedPhone = validateAndFormatPhone(phone);
    
    if (!formattedPhone) {
        return res.status(400).json({ 
            success: false, 
            message: 'Número de teléfono inválido. Debe ser un número mexicano de 10 dígitos (ej: 9381770841) o incluir 52 (ej: 529381770841)' 
        });
    }
    
    // Si no viene email, asignar por defecto
    const userEmail = email || `${username}@usuario.com`;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username: username.trim(),
                email: userEmail,
                phone: formattedPhone,
                password: hashedPassword,
                role: 'user'
            }])
            .select();
        
        if (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(400).json({ 
                    success: false, 
                    message: 'El usuario ya existe' 
                });
            }
            throw error;
        }
        
        res.json({ 
            success: true, 
            message: 'Usuario registrado exitosamente',
            phone: formattedPhone // Opcional: devolver el teléfono formateado
        });
        
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Login (sin cambios, solo adaptado a Supabase)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const supabase = getDb();
    
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .limit(1);
        
        if (error) throw error;
        
        const user = users?.[0];
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cambiar contraseña (adaptado a Supabase)
router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const supabase = getDb();
    
    if (req.user.role === 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Los administradores no pueden cambiar su contraseña desde esta sección' 
        });
    }
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }
    
    if (newPassword.length < 4) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres' });
    }
    
    try {
        const { data: users, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .limit(1);
        
        if (findError) throw findError;
        
        const user = users?.[0];
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedNewPassword })
            .eq('id', userId);
        
        if (updateError) throw updateError;
        
        res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Verificar token (adaptado a Supabase)
router.post('/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const supabase = getDb();
        
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, email, phone, role')
            .eq('id', decoded.id)
            .limit(1);
        
        if (error) throw error;
        
        const user = users?.[0];
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

module.exports = router;
