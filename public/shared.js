// ==================== CONFIGURACIÓN GLOBAL ====================
const API_URL = '/api';
let authToken = null;
let currentUser = null;
let cart = [];

const CONFIG = {
    WHATSAPP_NUMBER: "529381770841", // Número corregido: +52 9381770841
    BANK: {
        name: "BBVA México",
        account: "1234 5678 9012 3456",
        clabe: "012 345 6789 01234567 8"
    },
    MIN_ADVANCE_DAYS: 2
};

// ==================== FUNCIONES DE VALIDACIÓN ====================

// Validar usuario (3-20 caracteres, solo letras/números/guion bajo)
function isValidUsername(username) {
    if (!username || username.trim() === '') return false;
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username.trim());
}

// Validar email
function isValidEmail(email) {
    if (!email || email.trim() === '') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
}

// Validar teléfono mexicano (OBLIGATORIO - 52 + 10 dígitos)
function isValidPhone(phone) {
    if (!phone || phone.trim() === '') return false; // AHORA ES OBLIGATORIO
    
    // Limpiar el número: eliminar espacios, guiones, +, etc.
    let cleanPhone = phone.toString().replace(/[\s\-\(\)\+]/g, '');
    
    // Acepta formato: 529381770841 (13 dígitos comenzando con 52)
    // O formato: 9381770841 (10 dígitos, se agregará 52 automáticamente)
    if (cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone)) {
        return true; // Número válido de 10 dígitos (se agregará 52 después)
    }
    if (cleanPhone.length === 13 && cleanPhone.startsWith('52') && /^\d{13}$/.test(cleanPhone)) {
        return true; // Número completo con código de país
    }
    return false;
}

// Formatear número de teléfono para WhatsApp (siempre con 52)
function formatPhoneNumber(phone) {
    if (!phone) return '';
    
    let cleanPhone = phone.toString().replace(/[\s\-\(\)\+]/g, '');
    
    // Si tiene 10 dígitos, agregar 52
    if (cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone)) {
        return '52' + cleanPhone;
    }
    
    // Si ya tiene 13 dígitos y empieza con 52, retornar como está
    if (cleanPhone.length === 13 && cleanPhone.startsWith('52')) {
        return cleanPhone;
    }
    
    // Si tiene +52 al inicio, quitar el +
    if (cleanPhone.startsWith('+52')) {
        return cleanPhone.substring(1);
    }
    
    return cleanPhone;
}

// Validar contraseña (mínimo 4 caracteres)
function isValidPassword(password) {
    return password && password.length >= 4;
}

// Obtener mensajes de error de validación (TELÉFONO AHORA ES OBLIGATORIO)
function getValidationErrors(username, email, phone, password, confirmPassword) {
    const errors = [];
    
    // Validar usuario
    if (!username || username.trim() === '') {
        errors.push('❌ El usuario es requerido');
    } else {
        const usernameTrimmed = username.trim();
        if (usernameTrimmed.length < 3) {
            errors.push('❌ El usuario debe tener al menos 3 caracteres');
        } else if (usernameTrimmed.length > 20) {
            errors.push('❌ El usuario no puede tener más de 20 caracteres');
        } else if (!/^[a-zA-Z0-9_]+$/.test(usernameTrimmed)) {
            errors.push('❌ El usuario solo puede contener letras, números y guión bajo');
        }
    }
    
    // Validar email
    if (!email || email.trim() === '') {
        errors.push('❌ El correo electrónico es requerido');
    } else if (!isValidEmail(email)) {
        errors.push('❌ Ingresa un correo electrónico válido (ej: usuario@dominio.com)');
    }
    
    // Validar teléfono mexicano (AHORA ES OBLIGATORIO)
    if (!phone || phone.trim() === '') {
        errors.push('❌ El número de teléfono es requerido');
    } else if (!isValidPhone(phone)) {
        errors.push('❌ Número de teléfono inválido. Usa formato: 9381770841 o 529381770841');
    }
    
    // Validar contraseña
    if (!password) {
        errors.push('❌ La contraseña es requerida');
    } else if (password.length < 4) {
        errors.push('❌ La contraseña debe tener al menos 4 caracteres');
    }
    
    // Validar confirmación
    if (password !== confirmPassword) {
        errors.push('❌ Las contraseñas no coinciden');
    }
    
    return errors;
}

// ... el resto del código (getPasswordStrength, register, login, etc.) se mantiene igual ...

// ==================== VALIDACIONES EN TIEMPO REAL PARA REGISTRO ====================

function setupRealTimeValidation() {
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regPhone = document.getElementById('regPhone');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');
    
    if (!regUsername) return;
    
    // Crear elementos de feedback si no existen
    function ensureFeedback(input, id) {
        let feedback = input.nextElementSibling;
        if (!feedback || !feedback.classList.contains('invalid-feedback')) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.id = id;
            input.parentNode.insertBefore(feedback, input.nextSibling);
        }
        return feedback;
    }
    
    const userFeedback = ensureFeedback(regUsername, 'usernameFeedback');
    const emailFeedback = ensureFeedback(regEmail, 'emailFeedback');
    const phoneFeedback = ensureFeedback(regPhone, 'phoneFeedback');
    const pwdFeedback = ensureFeedback(regPassword, 'pwdFeedback');
    const confirmFeedback = ensureFeedback(regConfirmPassword, 'confirmFeedback');
    
    // Validar usuario en tiempo real
    function validateUsernameRealTime() {
        const username = regUsername.value.trim();
        
        if (username === '') {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Usuario requerido';
            userFeedback.classList.add('show');
            return false;
        }
        
        if (username.length < 3) {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Mínimo 3 caracteres';
            userFeedback.classList.add('show');
            return false;
        }
        
        if (username.length > 20) {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Máximo 20 caracteres';
            userFeedback.classList.add('show');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            regUsername.classList.add('is-invalid');
            regUsername.classList.remove('is-valid');
            userFeedback.textContent = 'Solo letras, números y _';
            userFeedback.classList.add('show');
            return false;
        }
        
        regUsername.classList.remove('is-invalid');
        regUsername.classList.add('is-valid');
        userFeedback.classList.remove('show');
        return true;
    }
    
    // Validar email en tiempo real
    function validateEmailRealTime() {
        const email = regEmail.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email === '') {
            regEmail.classList.add('is-invalid');
            regEmail.classList.remove('is-valid');
            emailFeedback.textContent = 'Correo requerido';
            emailFeedback.classList.add('show');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            regEmail.classList.add('is-invalid');
            regEmail.classList.remove('is-valid');
            emailFeedback.textContent = 'Formato inválido (ej: usuario@dominio.com)';
            emailFeedback.classList.add('show');
            return false;
        }
        
        regEmail.classList.remove('is-invalid');
        regEmail.classList.add('is-valid');
        emailFeedback.classList.remove('show');
        return true;
    }
    
    // Validar teléfono mexicano en tiempo real (AHORA OBLIGATORIO)
    function validatePhoneRealTime() {
        let phone = regPhone.value.trim();
        
        if (phone === '') {
            regPhone.classList.add('is-invalid');
            regPhone.classList.remove('is-valid');
            phoneFeedback.textContent = 'El número de teléfono es requerido';
            phoneFeedback.classList.add('show');
            return false;
        }
        
        // Limpiar caracteres especiales
        let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        
        // Validar formato: 10 dígitos o 13 dígitos con 52
        if (cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone)) {
            regPhone.classList.remove('is-invalid');
            regPhone.classList.add('is-valid');
            phoneFeedback.classList.remove('show');
            return true;
        }
        
        if (cleanPhone.length === 13 && cleanPhone.startsWith('52') && /^\d{13}$/.test(cleanPhone)) {
            regPhone.classList.remove('is-invalid');
            regPhone.classList.add('is-valid');
            phoneFeedback.classList.remove('show');
            return true;
        }
        
        regPhone.classList.add('is-invalid');
        regPhone.classList.remove('is-valid');
        phoneFeedback.textContent = 'Número inválido. Usa formato: 9381770841 (10 dígitos)';
        phoneFeedback.classList.add('show');
        return false;
    }
    
    // Validar contraseña en tiempo real con medidor
    function validatePasswordRealTime() {
        const password = regPassword.value;
        
        // Actualizar medidor de fortaleza
        const strength = getPasswordStrength(password);
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        
        if (strengthFill) {
            strengthFill.style.width = strength.width + '%';
            strengthFill.style.backgroundColor = strength.color;
        }
        if (strengthText) {
            strengthText.textContent = strength.text;
            strengthText.style.color = strength.color;
        }
        
        if (password === '') {
            regPassword.classList.add('is-invalid');
            regPassword.classList.remove('is-valid');
            pwdFeedback.textContent = 'Contraseña requerida';
            pwdFeedback.classList.add('show');
            return false;
        }
        
        if (password.length < 4) {
            regPassword.classList.add('is-invalid');
            regPassword.classList.remove('is-valid');
            pwdFeedback.textContent = 'Mínimo 4 caracteres';
            pwdFeedback.classList.add('show');
            return false;
        }
        
        regPassword.classList.remove('is-invalid');
        regPassword.classList.add('is-valid');
        pwdFeedback.classList.remove('show');
        
        // Re-validar confirmación
        if (regConfirmPassword.value) {
            validateConfirmRealTime();
        }
        
        return true;
    }
    
    // Validar confirmación en tiempo real
    function validateConfirmRealTime() {
        const password = regPassword.value;
        const confirm = regConfirmPassword.value;
        
        if (confirm === '') {
            regConfirmPassword.classList.add('is-invalid');
            regConfirmPassword.classList.remove('is-valid');
            confirmFeedback.textContent = 'Confirma tu contraseña';
            confirmFeedback.classList.add('show');
            return false;
        }
        
        if (password !== confirm) {
            regConfirmPassword.classList.add('is-invalid');
            regConfirmPassword.classList.remove('is-valid');
            confirmFeedback.textContent = 'Las contraseñas no coinciden';
            confirmFeedback.classList.add('show');
            return false;
        }
        
        regConfirmPassword.classList.remove('is-invalid');
        regConfirmPassword.classList.add('is-valid');
        confirmFeedback.classList.remove('show');
        return true;
    }
    
    // Asignar eventos
    regUsername.addEventListener('input', validateUsernameRealTime);
    regEmail.addEventListener('input', validateEmailRealTime);
    regPhone.addEventListener('input', validatePhoneRealTime);
    regPassword.addEventListener('input', validatePasswordRealTime);
    regConfirmPassword.addEventListener('input', validateConfirmRealTime);
    
    // Toggle password visibility
    const togglePwd = document.getElementById('togglePassword');
    const toggleConfirm = document.getElementById('toggleConfirmPassword');
    
    if (togglePwd) {
        togglePwd.addEventListener('click', function() {
            const type = regPassword.type === 'password' ? 'text' : 'password';
            regPassword.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
    
    if (toggleConfirm) {
        toggleConfirm.addEventListener('click', function() {
            const type = regConfirmPassword.type === 'password' ? 'text' : 'password';
            regConfirmPassword.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
}

// ... el resto del código (initializePanels, initializeTabs, initializeAuth, etc.) se mantiene igual ...
    }
    
    initializePanels();
    initializeTabs();
    initializeAuth();
});
