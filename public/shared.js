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

// ==================== INICIALIZACIÓN DE PANELES ====================
function initializePanels() {
    const menuBtn = document.getElementById('menuBtn');
    const menuPanel = document.getElementById('menuPanel');
    const cartBtn = document.getElementById('cartBtn');
    const cartPanel = document.getElementById('cartPanel');
    const userBtn = document.getElementById('userBtn');
    const userPanel = document.getElementById('userPanel');
    const overlay = document.getElementById('overlay');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
    const cancelPhoneBtn = document.getElementById('cancelPhoneBtn');
    const paymentPanel = document.getElementById('paymentPanel');
    const phonePanel = document.getElementById('phonePanel');
    const fileInput = document.getElementById('paymentProof');
    const previewDiv = document.getElementById('imagePreview');
    
    let pendingPaymentImage = null;
    
    if (menuBtn && menuPanel) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = menuPanel.style.display === 'block';
            menuPanel.style.display = isVisible ? 'none' : 'block';
            if (cartPanel) cartPanel.style.display = 'none';
            if (userPanel) userPanel.style.display = 'none';
        });
    }
    
    if (cartBtn && cartPanel) {
        cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = cartPanel.style.display === 'block';
            cartPanel.style.display = isVisible ? 'none' : 'block';
            if (userPanel) userPanel.style.display = 'none';
            if (menuPanel) menuPanel.style.display = 'none';
        });
    }
    
    if (userBtn && userPanel) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = userPanel.style.display === 'block';
            userPanel.style.display = isVisible ? 'none' : 'block';
            if (cartPanel) cartPanel.style.display = 'none';
            if (menuPanel) menuPanel.style.display = 'none';
            
            // Configurar validaciones en tiempo real cuando se abre el panel
            if (!isVisible) {
                setTimeout(setupRealTimeValidation, 100);
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (cartPanel && !cartPanel.contains(e.target) && e.target !== cartBtn) {
            cartPanel.style.display = 'none';
        }
        if (userPanel && !userPanel.contains(e.target) && e.target !== userBtn) {
            userPanel.style.display = 'none';
        }
        if (menuPanel && !menuPanel.contains(e.target) && e.target !== menuBtn) {
            menuPanel.style.display = 'none';
        }
    });
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                Swal.fire('Carrito vacío', 'Agrega productos para continuar', 'warning');
            } else if (!currentUser) {
                Swal.fire('Inicia sesión', 'Debes iniciar sesión para continuar', 'warning');
                if (userPanel) userPanel.style.display = 'block';
            } else {
                if (overlay) overlay.style.display = 'block';
                if (paymentPanel) paymentPanel.style.display = 'block';
            }
        });
    }
    
    if (fileInput && previewDiv) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    previewDiv.innerHTML = `<img src="${ev.target.result}" alt="Vista previa" class="img-fluid rounded" style="max-width: 100%; max-height: 150px; margin-top: 10px;">`;
                    pendingPaymentImage = ev.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                previewDiv.innerHTML = '';
                pendingPaymentImage = null;
            }
        });
    }
    
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', () => {
            if (!pendingPaymentImage) {
                Swal.fire('Comprobante requerido', 'Debes subir una imagen del comprobante de pago', 'warning');
                return;
            }
            if (overlay) overlay.style.display = 'none';
            if (paymentPanel) paymentPanel.style.display = 'none';
            const phoneInput = document.getElementById('customerPhone');
            if (phoneInput && currentUser) phoneInput.value = currentUser.phone || '';
            if (phonePanel) phonePanel.style.display = 'block';
        });
    }
    
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', () => {
            if (overlay) overlay.style.display = 'none';
            if (paymentPanel) paymentPanel.style.display = 'none';
            if (previewDiv) previewDiv.innerHTML = '';
            pendingPaymentImage = null;
            if (fileInput) fileInput.value = '';
        });
    }
    
    if (sendWhatsAppBtn) {
        sendWhatsAppBtn.addEventListener('click', async () => {
            const phone = document.getElementById('customerPhone')?.value.trim();
            const serviceDate = document.getElementById('serviceDate')?.value;
            const serviceTime = document.getElementById('serviceTime')?.value;
            
            if (!phone) {
                Swal.fire('Teléfono requerido', 'Ingresa tu número de teléfono', 'warning');
                return;
            }
            if (!serviceDate) {
                Swal.fire('Fecha requerida', 'Selecciona la fecha del servicio', 'warning');
                return;
            }
            
            await sendOrderWithImage(phone, pendingPaymentImage, serviceDate, serviceTime);
        });
    }
    
    if (cancelPhoneBtn) {
        cancelPhoneBtn.addEventListener('click', () => {
            if (overlay) overlay.style.display = 'none';
            if (phonePanel) phonePanel.style.display = 'none';
            if (previewDiv) previewDiv.innerHTML = '';
            pendingPaymentImage = null;
            if (fileInput) fileInput.value = '';
        });
    }
}

function initializeTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            const tabContent = document.getElementById(`${tab}Tab`);
            if (tabContent) tabContent.style.display = 'block';
            document.querySelectorAll('[data-tab]').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            // Configurar validaciones cuando se abre el tab de registro
            if (tab === 'register') {
                setTimeout(setupRealTimeValidation, 100);
            }
        });
    });
}

function initializeAuth() {
    const doLoginBtn = document.getElementById('doLoginBtn');
    const doRegisterBtn = document.getElementById('doRegisterBtn');
    const doLogoutBtn = document.getElementById('doLogoutBtn');
    
    if (doLoginBtn) {
        doLoginBtn.addEventListener('click', async () => {
            const username = document.getElementById('loginUsername')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;
            
            doLoginBtn.disabled = true;
            const originalText = doLoginBtn.innerHTML;
            doLoginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Ingresando...';
            
            const success = await login(username, password);
            
            if (!success) {
                doLoginBtn.disabled = false;
                doLoginBtn.innerHTML = originalText;
            }
        });
    }
    
    if (doRegisterBtn) {
        doRegisterBtn.addEventListener('click', async () => {
            const username = document.getElementById('regUsername')?.value.trim();
            const email = document.getElementById('regEmail')?.value.trim();
            const phone = document.getElementById('regPhone')?.value.trim();
            const password = document.getElementById('regPassword')?.value;
            const confirm = document.getElementById('regConfirmPassword')?.value;
            
            doRegisterBtn.disabled = true;
            const originalText = doRegisterBtn.innerHTML;
            doRegisterBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Registrando...';
            
            const success = await register(username, email, phone, password, confirm);
            
            doRegisterBtn.disabled = false;
            doRegisterBtn.innerHTML = originalText;
            
            if (success) {
                // Limpiar formulario
                const inputs = ['regUsername', 'regEmail', 'regPhone', 'regPassword', 'regConfirmPassword'];
                inputs.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.value = '';
                        input.classList.remove('is-valid', 'is-invalid');
                    }
                });
                
                // Limpiar medidor
                const strengthFill = document.getElementById('strengthFill');
                const strengthText = document.getElementById('strengthText');
                if (strengthFill) strengthFill.style.width = '0%';
                if (strengthText) strengthText.textContent = '';
                
                // Cambiar a login
                const loginTab = document.querySelector('[data-tab="login"]');
                if (loginTab) loginTab.click();
            }
        });
    }
    
    if (doLogoutBtn) {
        doLogoutBtn.addEventListener('click', () => {
            logout();
            const userPanel = document.getElementById('userPanel');
            if (userPanel) userPanel.style.display = 'none';
        });
    }
}

// ==================== ANIMACIONES CSS ADICIONALES ====================
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    .is-invalid {
        animation: shake 0.3s ease-in-out;
    }
    .spinner-border-sm {
        width: 1rem;
        height: 1rem;
        border-width: 0.2em;
    }
    .btn-gold:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
    }
`;
document.head.appendChild(styleSheet);

// ==================== INICIALIZACIÓN PRINCIPAL ====================
document.addEventListener('DOMContentLoaded', async () => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        updateUserUI();
        await loadUserCart();
    }
    
    if (document.getElementById('barrasGrid')) {
        await renderBarras();
    }
    
    if (document.getElementById('promoGrid')) {
        await renderPromociones();
    }
    
    initializePanels();
    initializeTabs();
    initializeAuth();
});
