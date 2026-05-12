// Configuración de Supabase
const supabaseUrl = 'https://fitdumgnaqmoxdvdczhb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdGR1bWduYXFtb3hkdmRjemhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjE5NTcsImV4cCI6MjA5MTAzNzk1N30.7emX15BICaQD6ZRRm-SxN1iVXik__aPY6anUqd51z5k';
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const params = new URLSearchParams(window.location.search);
const code = params.get('code');

// 1. VARIABLE GLOBAL PARA EL CLÚSTER 
let clusterIdActual = null;
let currentRequestId = null;
let uuidInvitadorActual = null;

// =========================================================================
// FUNCIÓN 1: AL CARGAR LA PÁGINA 
// =========================================================================
window.onload = async () => {
    const uiPrincipal = document.getElementById('ui-principal');
    const uiError = document.getElementById('ui-error');

    if (!code) {
        uiPrincipal.style.display = 'none';
        uiError.style.display = 'block';
        return;
    }

    try {
        const { data, error } = await clienteSupabase
            .from('invitaciones')
            .select(`
                creador_id,
                cluster_id,
                usos_restantes,
                perfiles ( username ),
                clusteres ( nombre, ciudades ( nombre ) )
            `)
            .eq('codigo', code)
            .single();

        // CHIVATO: Si hay un error, lo imprimimos en rojo en la consola
        if (error) {
            console.error("ERROR EXACTO DE SUPABASE:", error);
            uiPrincipal.style.display = 'none';
            uiError.style.display = 'block';
            return;
        }

        // CHIVATO 2: Si no hay error pero no encuentra el código
        if (!data) {
            console.error("SUPABASE DICE: No he encontrado ningún código que sea exactamente igual a:", code);
            uiPrincipal.style.display = 'none';
            uiError.style.display = 'block';
            return;
        }

        if (data.usos_restantes <= 0) {
            uiPrincipal.style.display = 'none';
            uiError.style.display = 'block';
            uiError.innerHTML = `<h2>Invitaciones agotadas</h2><p>Las invitaciones ya han sido utilizadas.</p>`;
            return;
        }

        // GUARDAMOS EL CLÚSTER
        clusterIdActual = data.cluster_id;
        uuidInvitadorActual = data.creador_id;

        const nombreInvitador = data.perfiles?.username || 'Un amigo';
        const nombreCiudad = data.clusteres?.ciudades?.nombre || 'Tu ciudad';

        document.getElementById('texto-principal').innerHTML =
            `<span class="nombre-invitador">${nombreInvitador}</span> te invita a entrar`;
        document.getElementById('cluster-name').innerText = `📍 ${nombreCiudad}`;

    } catch (err) {
        console.error("Error de conexión (catch):", err);
        uiPrincipal.style.display = 'none';
        uiError.style.display = 'block';
    }
};

// =========================================================================
// FUNCIÓN 2: AL PULSAR "UNIRME AHORA"
// =========================================================================
async function handleRegistro(e) {
    e.preventDefault();

    // --- VALIDACIÓN DEL CAPTCHA ---
    const captchaResponse = grecaptcha.getResponse();
    
    // Si la respuesta está vacía, es que no ha marcado la casilla
    if (captchaResponse.length === 0) {
        alert("Por favor, confirma que no eres un robot completando la casilla de seguridad.");
        return; // Esto "mata" la función aquí mismo y no envía nada a Supabase
    }
    
    const btn = document.querySelector('.boton-join');
    const textoOriginal = btn.innerText;

    const usernameCrudo = document.getElementById('input-username').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const password = document.getElementById('input-password').value;
    const telefonoCrudo = document.getElementById('input-telefono').value.trim();
    const fechaNacimientoCruda = document.getElementById('input-fecha-nacimiento').value;

    const usernameLimpio = usernameCrudo.replace(/^@/, '').toLowerCase(); 
    document.getElementById('input-username').value = '@' + usernameLimpio;

    const telefonoSoloNumeros = telefonoCrudo.replace(/[\s\-\.]/g, '');
    const telefonoLimpio = '+34' + telefonoSoloNumeros;
    document.getElementById('input-telefono').value = telefonoSoloNumeros;

    if (usernameLimpio.length < 3) return alert("El nombre de usuario debe tener al menos 3 letras.");
    
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) return alert("Por favor, introduce un email válido.");

    const regexE164España = /^\+34[67]\d{8}$/;
    if (!regexE164España.test(telefonoLimpio)) return alert("Introduce un móvil válido de 9 cifras.");

    if (!fechaNacimientoCruda) return alert("Por favor, introduce tu fecha de nacimiento.");
    
    const fechaNac = new Date(fechaNacimientoCruda);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
    if (edad < 18) return alert("Debes ser mayor de 18 años para entrar a Zumo.");

    btn.innerText = "Comprobando datos...";
    btn.style.opacity = "0.7";
    btn.disabled = true;

    try {
        // 1. Verificamos que la invitación y los datos son válidos en Supabase primero
        const { data: resultado, error: errorValidacion } = await clienteSupabase.rpc('verificar_y_consumir_invitacion', {
            p_username: usernameLimpio,
            p_email: email,
            p_telefono: telefonoLimpio,
            p_codigo: code
        }); //

        if (errorValidacion) throw errorValidacion;

        if (resultado === 'error_codigo') throw new Error("¡Alguien se te ha adelantado! Invitaciones agotadas.");
        if (resultado === 'error_username') throw new Error("Este @usuario ya existe.");
        if (resultado === 'error_email') throw new Error("Este email ya está registrado.");
        if (resultado === 'error_telefono') throw new Error("Este teléfono ya está asociado a una cuenta.");

        btn.innerText = "Enviando código...";

        // 2. Pedimos el OTP a la Edge Function (Usando email por ahora para ahorrar costes)
        const { data: otpData, error: otpError } = await clienteSupabase.functions.invoke('hub-pro-auth', {
            body: { 
                action: 'request', 
                payload: { email: email },
                recaptcha_token: captchaResponse  // TOKEN DEL CAPTCHA
            }
        });

        if (otpError || otpData.error) throw new Error("No se pudo enviar el código de verificación.");

        // 3. Guardamos el ticket y mostramos la pantalla del paso 2
        currentRequestId = otpData.request_id; // Este ID es devuelto por /request_otp
        
        document.getElementById('form-registro').style.display = 'none';
        document.getElementById('form-otp').style.display = 'flex';

    } catch (err) {
        alert(err.message || "Hubo un problema de conexión. Inténtalo de nuevo.");
        btn.innerText = textoOriginal;
        btn.style.opacity = "1";
        btn.disabled = false;
    }
}

// =========================================================================
// FUNCIÓN 3: AL PULSAR "VERIFICAR Y ENTRAR"
// =========================================================================
async function handleVerificarOTP() {
    const otpInput = document.getElementById('input-otp').value.trim();
    const btn = document.getElementById('btn-verificar');
    const textoOriginal = btn.innerText;

    if (otpInput.length !== 6) {
        return alert("El código debe tener 6 dígitos.");
    }

    btn.innerText = "Verificando...";
    btn.style.opacity = "0.7";
    btn.disabled = true;

    try {
        // 1. Preguntamos a Hub Pro si el código es correcto
        const { data: verifyData, error: verifyError } = await clienteSupabase.functions.invoke('hub-pro-auth', {
            body: { 
                action: 'verify', 
                payload: { request_id: currentRequestId, otp: otpInput } // Formato requerido
            }
        });

        if (verifyError || verifyData.error) {
            throw new Error("El código es incorrecto o ha caducado.");
        }

        // Si la API no responde con status "verified", frenamos
        if (verifyData.status !== 'verified') {
             throw new Error("Error en la verificación.");
        }

        btn.innerText = "Creando cuenta en Zumo...";

        // 2. ¡El usuario es quien dice ser! Rescatamos los datos del DOM oculto
        const email = document.getElementById('input-email').value.trim();
        const password = document.getElementById('input-password').value;
        const usernameLimpio = document.getElementById('input-username').value.trim().replace(/^@/, '');
        const telefonoLimpio = '+34' + document.getElementById('input-telefono').value.trim();
        const fechaNacimientoCruda = document.getElementById('input-fecha-nacimiento').value;

        // 3. Ejecutamos la creación real en Supabase
        const { data: authData, error: authError } = await clienteSupabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: usernameLimpio, 
                    telefono: telefonoLimpio,
                    cluster_id: clusterIdActual,
                    fecha_nacimiento: fechaNacimientoCruda,
                    invitado_por: uuidInvitadorActual
                }
            }
        });

        if (authError) {
            // Si Supabase falla, devolvemos la vida de la invitación para no perderla
            await clienteSupabase.rpc('devolver_vida_invitacion', { p_codigo: code });
            throw authError; 
        }

        btn.innerText = "¡Bienvenido a Zumo!";
        btn.style.background = "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)"; 

        setTimeout(() => {
            document.getElementById('ui-principal').style.display = 'none';
            document.getElementById('ui-exito').style.display = 'flex'; 
        }, 1500);

    } catch (err) {
        alert(err.message);
        btn.innerText = textoOriginal;
        btn.style.opacity = "1";
        btn.disabled = false;
    }
}

    

