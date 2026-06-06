const supabase = require('./config/supabase');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
    console.log('🔌 Conectando a Supabase...');
    
    // Verificar conexión
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error) {
        console.error('❌ Error conectando a Supabase:', error.message);
        throw error;
    }
    
    console.log('✅ Conectado a Supabase correctamente');
    
    // Insertar datos iniciales
    await insertInitialData();
    
    return supabase;
}

// ========== FUNCIONES DE INSERCIÓN DE DATOS ==========
async function insertInitialData() {
    // Verificar si ya hay admin
    const { data: adminExists } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1);
    
    if (!adminExists || adminExists.length === 0) {
        // Admin por defecto
        const adminPassword = await bcrypt.hash('admin123', 10);
        const { error: adminError } = await supabase
            .from('users')
            .insert([{
                username: 'admin',
                email: 'admin@lapomme.com',
                phone: '529381770841',
                password: adminPassword,
                role: 'admin'
            }]);
        
        if (adminError) console.error('Error creando admin:', adminError);
        
        // Usuario demo
        const demoPassword = await bcrypt.hash('123456', 10);
        const { error: demoError } = await supabase
            .from('users')
            .insert([{
                username: 'demo',
                email: 'demo@example.com',
                phone: '529381770841',
                password: demoPassword,
                role: 'user'
            }]);
        
        if (demoError) console.error('Error creando demo:', demoError);
        
        console.log('✅ Usuarios creados: admin / demo');
    }
    
    // Barras
    const { count: barrasCount, error: countError } = await supabase
        .from('barras')
        .select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error('Error contando barras:', countError);
        return;
    }
    
    if (barrasCount === 0) {
        const barrasData = [
            { nombre: "Barra de Esquites", descripcion: "Elote tierno desgranado, crema, mayonesa, queso, limón y sal, los complementos se los añades a tu gusto.", categoria: "Clásica", imagen: "img/per5.jpg" },
            { nombre: "Barra de Snacks", descripcion: "Variedad de papas, churrumais, cacahuates normales y enchilados, gomitas, hot cakes, frutas y más.", categoria: "Botanas", imagen: "img/per2.jpg" },
            { nombre: "Paletas Locas", descripcion: "Paletas de hielo cubiertas con chamoy, miguelito, gomitas y más.", categoria: "Postres", imagen: "img/pa1.jpg" },
            { nombre: "Barra de Hot Dogs", descripcion: "Hot dogs gourmet y toppings exclusivos.", categoria: "Salados", imagen: "img/hotd1.jpg" },
            { nombre: "Barra de Sopas instantáneas", descripcion: "Sopas instantáneas.", categoria: "Sopas", imagen: "img/nissi1.jpg" },
            { nombre: "Barra de Nachos", descripcion: "Nachos con queso derretido, pico de gallo y jalapeños.", categoria: "Botanas", imagen: "img/per3.jpg" },
            { nombre: "Barra de Chilaquiles", descripcion: "Chilaquiles rojos o verdes, crema, queso y con pollo", categoria: "Mexicana", imagen: "img/ch2.jpg" },
            { nombre: "Barra de Chicharrones preparados", descripcion: "Deliciosos chicharrones preparados", categoria: "Botanas", imagen: "img/chi1.jpg" },
            { nombre: "Barra de Tostielote", descripcion: "Deliciosos tostielotes preparados", categoria: "Mexicana", imagen: "img/tosti1.jpg" }
        ];
        
        const preciosConfig = {
            30: [350, 450, 380, 520, 480, 420, 550, 550, 550],
            40: [450, 580, 490, 670, 620, 540, 710, 710, 710],
            50: [550, 700, 600, 820, 760, 660, 870, 870, 870],
            60: [650, 820, 710, 970, 900, 780, 1030, 1030, 1030],
            70: [750, 940, 820, 1120, 1040, 900, 1190, 1190, 1190],
            80: [850, 1060, 930, 1270, 1180, 1020, 1350, 1350, 1350],
            90: [950, 1180, 1040, 1420, 1320, 1140, 1510, 1510, 1510],
            100: [1050, 1300, 1150, 1570, 1460, 1260, 1670, 1670, 1670]
        };
        
        const ingredientesMap = {
            1: ["Elote blanco", "Crema", "Mayonesa", "Queso", "Limón", "Sal"],
            2: ["Salsa botanera", "Chamoy", "Miguelito", "Tajin", "Entre otros"],
            3: ["Paletas de hielo", "Chamoy", "Miguelito", "Gomitas", "Entre otros"],
            4: ["Jalapeños", "Tomate", "Cebolla", "Sabritas"],
            5: ["Fideos de camarones", "Fideos de res", "Fideos de pollo", "Toppings especiales"],
            6: ["Totopos", "Queso cheddar", "Jalapeños"],
            7: ["Totopos", "Salsa roja o Salsa verde", "Crema", "Queso fresco"],
            8: ["Mayonesa", "Queso", "Crema", "El topping de tu agrado"],
            9: ["Mayonesa", "Queso", "Crema", "Limón", "Sal", "Queso cheddar", "Salsas de tu agrado"]
        };
        
        for (let i = 0; i < barrasData.length; i++) {
            const barra = barrasData[i];
            
            // Insertar barra
            const { data: nuevaBarra, error: barraError } = await supabase
                .from('barras')
                .insert([barra])
                .select()
                .single();
            
            if (barraError) {
                console.error('Error insertando barra:', barraError);
                continue;
            }
            
            const barraId = nuevaBarra.id;
            
            // Insertar precios
            for (const [personas, preciosArray] of Object.entries(preciosConfig)) {
                const precio = preciosArray[i];
                const { error: precioError } = await supabase
                    .from('precios_barra')
                    .insert([{
                        barra_id: barraId,
                        personas: parseInt(personas),
                        precio: precio
                    }]);
                
                if (precioError) console.error('Error insertando precio:', precioError);
            }
            
            // Insertar ingredientes
            const ingredientes = ingredientesMap[barraId] || ["Ingredientes variados"];
            for (const ing of ingredientes) {
                const { error: ingError } = await supabase
                    .from('ingredientes')
                    .insert([{
                        barra_id: barraId,
                        nombre: ing
                    }]);
                
                if (ingError) console.error('Error insertando ingrediente:', ingError);
            }
        }
        console.log('✅ Barras insertadas');
    }
    
    // Promociones
    const { count: promosCount, error: promosCountError } = await supabase
        .from('promociones')
        .select('*', { count: 'exact', head: true });
    
    if (promosCountError) {
        console.error('Error contando promociones:', promosCountError);
        return;
    }
    
    if (promosCount === 0) {
        const promocionesData = [
            { nombre: "Charola de botanas", descripcion: "Manzana enchilada en gajos con gomitas, sabritas y cacahuates.", precio: 225, precio_anterior: 250, badge: "10% OFF", imagen: "img/charola.jpg" },
            { nombre: "Manzanas enchiladas", descripcion: "Manzana cubierta de chamoy y miguelito, 20 Pz la orden.", precio: 300, precio_anterior: 400, badge: "Especial", imagen: "img/manzana.jpg" },
            { nombre: "Pinta Pellones", descripcion: "Excelente para fiestas infantiles.", precio: 550, precio_anterior: 700, badge: "Oferta", imagen: "img/lu1.jpg" },
            { nombre: "Yesitos", descripcion: "Diviertete pintando superheroes.", precio: 750, precio_anterior: 850, badge: "Oferta", imagen: "img/lu2.jpg" }
        ];
        
        for (const promo of promocionesData) {
            const { error: promoError } = await supabase
                .from('promociones')
                .insert([promo]);
            
            if (promoError) console.error('Error insertando promoción:', promoError);
        }
        console.log('✅ Promociones insertadas');
    }
}

function getDb() {
    return supabase;
}

module.exports = { initializeDatabase, getDb };