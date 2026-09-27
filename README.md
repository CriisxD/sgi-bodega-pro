# 📦 SGI Bodega Pro - Sistema de Gestión de Inventario y EPP

**SGI Bodega Pro** es una plataforma web y móvil diseñada para el control integral de bodegas de obra, inventario de herramientas, consumibles y la entrega formal de **Equipos de Protección Personal (EPP)** a los trabajadores en faenas de construcción e industrias.

---

## 🎯 Propósito y Realidad Operativa

En las obras y bodegas de terreno suele existir descontrol en el inventario y dificultad para registrar adecuadamente quién recibe cada equipo de protección o herramienta. Además, con frecuencia **la bodega o el terreno carecen de una conexión a internet estable**.

**SGI Bodega Pro** resuelve estos problemas ofreciendo:
* **Firma Digital In-situ:** Registro de entrega directo en teléfono/tablet con firma digital del trabajador.
* **Flujo Mixto / Offline (Vale Físico):** Si en bodega no hay internet o se usa papel, el Prevencionista/Supervisor puede crear el vale en formato físico y posteriormente **digitarlo en el sistema** para descontar el stock automáticamente de forma rápida sin redundancia de firmas.
* **Control por Roles:** Vistas adaptadas a lo que necesita cada rol (Prevencionista, Bodeguero, Jefatura, Administrador).

---

## 👥 Roles y Permisos

1. **Administrador / Jefatura:**
   * Control total de inventarios, categorías, trabajadores, obras y reportes globales.
   * Gestión de usuarios y asignación de roles.
2. **Prevencionista de Riesgos (PR / HSEQ):**
   * Creación rápida de vales de EPP y herramientas para los trabajadores.
   * Opción de **Digitar Vale Físico** (para registrar entregas que se hicieron en papel).
   * Consulta de historial de entregas de EPP por trabajador para auditorías de seguridad.
3. **Bodeguero:**
   * Recepción y despacho de insumos y herramientas.
   * Confirmación de entrega de vales digitales solicitados.
   * Consulta rápida de stock disponible en bodega.
4. **Supervisor / Capataz:**
   * Consulta del estado de entrega de sus cuadrillas.

---

## 🔄 Flujos Principales de Trabajo

### 1. Vale Digital (Creación en Terreno con Celular/Tablet)
1. El **Prevencionista** o **Bodeguero** abre la app desde su móvil.
2. Selecciona el **Trabajador** y los elementos a entregar (EPP / Herramientas).
3. El trabajador firma directamente en la pantalla del dispositivo.
4. El vale queda registrado y el stock se descuenta inmediatamente.

### 2. Ingresar Vale Físico (Registro Posterior / Sin Internet en Bodega)
*Diseñado para resolver el problema cuando el bodeguero no tiene internet o trabaja con hojas impresas.*
1. Se realiza la entrega física en bodega usando el formulario en papel tradicional.
2. El **Prevencionista** o **Encargado** ingresa al sistema desde un equipo conectado (PC o Celular) al módulo **"Ingresar Vale Físico"**.
3. Sigue el asistente guiado en 3 pasos:
   * **Paso 1:** Selecciona el Trabajador y la Fecha del vale físico.
   * **Paso 2:** Agrega los productos/EPP entregados (con búsqueda rápida y atajos de 1 click).
   * **Paso 3:** Confirma y guarda. El stock se descuenta automáticamente sin exigir firma digital secundaria.

---

## 🛠️ Stack Tecnológico

* **Frontend:** [Next.js 14](https://nextjs.org/) (App Router, Server Components y Client Components).
* **Estilos & UI:** [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) para componentes accesibles y modernos.
* **Íconos:** [Lucide React](https://lucide.dev/).
* **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL con Row Level Security).
* **Lenguaje:** TypeScript / JavaScript (ES6+).

---

## 📂 Estructura del Proyecto

```text
sgi-bodega-pro/
├── src/
│   ├── app/                    # Rutas y páginas (Next.js App Router)
│   │   ├── dashboard/          # Panel principal por roles
│   │   │   ├── vales/          # Vales, historial y creación ("fisico", "nuevo")
│   │   │   ├── inventario/     # Control de stock y herramientas
│   │   │   └── trabajadores/   # Gestión de nómina de trabajadores
│   │   ├── login/              # Inicio de sesión
│   │   └── page.tsx            # Redirección e inicio
│   ├── components/             # Componentes reutilizables (UI, tablas, modales)
│   ├── lib/                    # Configuración de Supabase y utilidades
│   └── types/                  # Definiciones de TypeScript
├── public/                     # Archivos estáticos e imágenes
├── README.md                   # Documentación del proyecto
└── package.json                # Dependencias y scripts
```

---

## 🚀 Instalación y Desarrollo Local

### Requisitos Previos
* **Node.js** v18.0.0 o superior.
* **npm**, **yarn** o **pnpm**.
* Proyecto activo en **Supabase** (para BD y autenticación).

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd sgi-bodega-pro
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno:**
   Crea un archivo `.env.local` en la raíz del proyecto con tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
   ```

4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador:**
   Ingresa a [http://localhost:3000](http://localhost:3000).

---

## 📝 Notas de Mantenimiento

* Al agregar nuevos módulos o cambiar permisos de roles, actualizar los componentes en `src/app/dashboard/` asegurando el chequeo de permisos de usuario.
* Mantener la compatibilidad responsiva (Mobile First para terreno y Desktop UI para módulos de oficina como "Digitar Vale Físico").

