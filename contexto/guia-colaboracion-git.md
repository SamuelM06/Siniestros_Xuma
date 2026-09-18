# Guía de Colaboración y Gestión en GitHub — Siniestros Xuma

## 1. Estado Actual y Contexto

- **Propietario / Creador:** Samuel (`SamuelM06`)
- **Repositorio Remoto:** [https://github.com/SamuelM06/Siniestros_Xuma](https://github.com/SamuelM06/Siniestros_Xuma)
- **Visibilidad Actual:** **Público** (se mantendrá público temporalmente mientras se avanza en el desarrollo conjunto).
- **Entorno Local:** `c:\01_Repositorios\03_Aplicaciones\11_Reporte_Siniestro` (rama `main`).

---

## 2. Flujo de Trabajo para Colaborar (Modo Público)

Para que puedas aportar tus mejoras y código al proyecto desde tu usuario de GitHub mientras el repositorio es público, se tienen dos métodos principales:

### Opción A (Recomendada): Colaborador Directo con Pull Requests

Este es el esquema más ágil para equipos que trabajan en conjunto:

1. **Invitación como Colaborador (Acción de Samuel):**
   - Samuel entra al repositorio en GitHub: [Siniestros_Xuma](https://github.com/SamuelM06/Siniestros_Xuma).
   - Va a **Settings** $\rightarrow$ **Collaborators** (o *Access* $\rightarrow$ *Collaborators*).
   - Pulsa en **Add people** y busca tu usuario o correo de GitHub.
2. **Aceptación:**
   - Recibirás una notificación y un correo de GitHub con el enlace para aceptar la invitación.
3. **Flujo de desarrollo diario:**
   ```bash
   # 1. Asegurar que estás en main y actualizado
   git checkout main
   git pull origin main

   # 2. Crear una rama descriptiva para tu cambio o funcionalidad
   git checkout -b feature/nombre-de-tu-mejora

   # 3. Desarrollar, probar y confirmar cambios
   git add .
   git commit -m "feat: descripción clara de la mejora agregada"

   # 4. Subir tu rama al repositorio remoto
   git push -u origin feature/nombre-de-tu-mejora
   ```
4. **Revisión e Integración (Pull Request):**
   - En la página de GitHub aparecerá el aviso para crear un **Pull Request (PR)** de tu rama hacia `main`.
   - Se revisan los cambios y Samuel (o cualquiera del equipo) realiza el *Merge* a `main`.

---

### Opción B: Modelo Fork (Bifurcación)

Si no cuentas con permisos de colaborador directo en el repositorio principal:

1. **Hacer Fork:**
   - Entras a [https://github.com/SamuelM06/Siniestros_Xuma](https://github.com/SamuelM06/Siniestros_Xuma) y pulsas el botón **Fork** arriba a la derecha para crear una copia en tu cuenta.
2. **Configurar Remotos:**
   ```bash
   # Renombrar el remoto actual a upstream (el de Samuel)
   git remote rename origin upstream

   # Agregar tu fork como origin
   git remote add origin https://github.com/TU_USUARIO/Siniestros_Xuma.git
   ```
3. **Trabajar y Subir:**
   - Subes tus ramas a tu `origin` (`git push -u origin feature/...`).
   - Desde la interfaz de tu GitHub abres un **Pull Request** hacia el repositorio `upstream` de Samuel.

---

## 3. Transición Futura: Cómo Pasar el Proyecto a Privado

Cuando se decida que el código debe ser confidencial y restringido:

### Pasos que debe realizar el creador (`SamuelM06`):
1. Ingresar a [github.com/SamuelM06/Siniestros_Xuma](https://github.com/SamuelM06/Siniestros_Xuma).
2. Entrar a la pestaña **Settings** del repositorio.
3. En la sección **General**, desplazarse hasta el final a la sección **Danger Zone**.
4. En **Change repository visibility**, hacer clic en **Change visibility** $\rightarrow$ seleccionar **Make private**.
5. Confirmar escribiendo el texto requerido en el diálogo.

### Consideraciones al volverlo privado:
- **Colaboradores:** Los colaboradores invitados previamente en la *Opción A* mantendrán su acceso de lectura/escritura sin interrupción.
- **Forks existentes:** Si alguien hizo un Fork público antes del cambio, ese fork no se borra automáticamente, por lo que es mejor mantener colaboradores directos y limitar la visibilidad lo más temprano posible.
- **Tokens y Credenciales:** Asegurarse de tener configurado Git Credential Manager o un Personal Access Token (PAT) / clave SSH para autenticar los comandos `git push`/`git pull`.

---

## 4. Buenas Prácticas de Seguridad y Trabajo en Equipo

1. **Variables de Entorno:**
   - Nunca subir el archivo `.env` al repositorio. Solo mantener actualizado el `.env.example` con variables dummy o de referencia.
2. **Validación Previa:**
   - Antes de subir un commit o PR, verificar que el proyecto compila correctamente:
     ```bash
     npm run build
     ```
3. **Sincronización Continua:**
   - Antes de iniciar una nueva tarea, traer siempre los cambios de `main`:
     ```bash
     git checkout main
     git pull origin main
     ```
