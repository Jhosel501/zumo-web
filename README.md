# 🧃 Zumo App - Web Registration MVP

![Estado](https://img.shields.io/badge/Estado-MVP_Completo-success)
![Seguridad](https://img.shields.io/badge/Seguridad-Zero_Trust-blue)
![Supabase](https://img.shields.io/badge/BaaS-Supabase-20B2AA?logo=supabase)
![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?logo=javascript&logoColor=black)

Portal de registro y validación de invitaciones para la aplicación Zumo. Este MVP (Producto Mínimo Viable) gestiona el flujo de entrada de nuevos usuarios mediante un sistema de códigos de invitación exclusivos, validación OTP (One-Time Password) y un alta segura en la base de datos.

El proyecto está diseñado bajo el paradigma de seguridad **Zero Trust (Confianza Cero)**, aislando el cliente de la lógica de negocio y delegando las verificaciones críticas al servidor para mitigar vulnerabilidades comunes (Evasión de CAPTCHA, Email Bombing, Tampering de datos).

## ✨ Características Principales

- **Sistema de Invitaciones Cerrado:** Validación en tiempo real de códigos de un solo uso mediante RPCs (Remote Procedure Calls) en PostgreSQL.
- **Autenticación en 2 Pasos (OTP):** Verificación de identidad delegada a pasarela externa antes de la creación del usuario.
- **UI/UX Inmersiva:** Interfaz "mobile-first" sin dependencias externas (CSS puro), optimizada para conversión y feedback visual instantáneo.
- **Protección Anti-Bot:** Integración de Google reCAPTCHA v2.

## 🛡️ Arquitectura de Seguridad (Zero Trust)

La infraestructura está diseñada asumiendo que el entorno del cliente (navegador) es hostil:

1. **Validación de reCAPTCHA en el Backend:** El token del frontend se envía a una *Edge Function* de Supabase, que se comunica de forma privada con los servidores de Google (`siteverify`). Esto bloquea ataques directos a la API (vía Postman/Scripts) que intenten saltarse la web.
2. **Mitigación de Agotamiento de Recursos (DoS):** Los envíos masivos de SMS/Emails están bloqueados por la pasarela de la Edge Function, protegiendo la cuota de la API corporativa de envíos de OTP.
3. **Manejo Seguro de Secretos:** Las API Keys del proveedor de mensajería y de Google reCAPTCHA residen exclusivamente en los *Secrets* del entorno Deno del servidor. El frontend solo expone la clave pública de Supabase (`anon key`).
4. **Row Level Security (RLS):** Todas las tablas de PostgreSQL tienen políticas estrictas que impiden la inyección o lectura de datos no autorizada desde orígenes anónimos.
5. **Transacciones Atómicas:** El consumo final de la invitación ocurre en un *Trigger* a nivel de base de datos (`AFTER INSERT` en auth), evitando condiciones de carrera o invitaciones duplicadas.

## 🛠️ Tecnologías Utilizadas

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Backend as a Service (BaaS):** Supabase (PostgreSQL, Auth).
- **Serverless:** Supabase Edge Functions (Deno / TypeScript).
- **Seguridad:** Google reCAPTCHA v2 API.

## 📂 Estructura del Proyecto

```text
zumo-web-mvp/
├── index.html       # Interfaz principal (Formularios, OTP, Pantalla de Éxito/Error)
├── favicon.svg      # Icono vectorial de la web
├── css/
│   └── style.css    # Estilos globales, variables de paleta, animaciones y responsive
└── js/
    └── app.js       # Lógica de cliente: captura de URL, validación de inputs y llamadas a API