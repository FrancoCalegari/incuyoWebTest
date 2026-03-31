# Instituto INCUYO Web

Este es el repositorio del sitio web de prueba para el **Instituto INCUYO** (Tecnicatura Superior en Desarrollo de Software). 

La página incluye:
- Información de la carrera, plan de estudios y certificaciones.
- Secciones animadas (scroll reveal).
- Galería de compromiso social.
- Carrusel infinito de tecnologías.
- Funcionalidad de contacto vía WhatsApp.
- **¡NUEVO!** Un Asistente Virtual Inteligente (chatbot) integrado, creado con la API de Google Gemini.

## Configuración Inicial (¡Importante!)

El Chatbot de IA necesita una API Key válida para funcionar. Las credenciales sensibles **no se suben al repositorio**. 

Sigue estos pasos para probar la página en tu máquina:

1. Clona o descarga este repositorio.
2. En la carpeta raíz del proyecto, busca el archivo `config.example.js`.
3. Haz una copia de ese archivo y renómbralo a `config.js` (en la misma carpeta).
   *Nota: `config.js` está ignorado en `.gitignore` para no subir tu clave accidentalmente.*
4. Abre `config.js` e ingresa tu API Key de Gemini reemplazando `YOUR_GEMINI_API_KEY_HERE`.

```javascript
window.INCUYO_CONFIG = {
  GEMINI_API_KEY: "AQUÍ_VA_TU_CLAVE_REAL" 
};
```

*(Si no tienes una API Key de Gemini, puedes conseguir una gratuita en [Google AI Studio](https://aistudio.google.com/)).*

## Cómo ejecutar el proyecto localmente

Debido a que el navegador restringe ciertas funcionalidades (como módulos de JS o peticiones a APIs externas) cuando se abren los archivos directamente (ej. `file:///`), es recomendable abrir el proyecto utilizando un **servidor local**.

### Alternativa 1: Extensión Live Server (Visual Studio Code)
1. Abre la carpeta del proyecto en Visual Studio Code.
2. Instala la extensión **Live Server** de Ritwick Dey.
3. Haz clic derecho sobre el archivo `index.html` y selecciona **"Open with Live Server"**.
4. ¡Listo! La página se abrirá en tu navegador (usualmente en `http://127.0.0.1:5500`).

### Alternativa 2: Node.js (http-server)
Si tienes Node.js instalado, puedes abrir la terminal en la carpeta del proyecto y ejecutar:
```bash
npx http-server
```
Luego visita la URL que te indique la terminal.

### Alternativa 3: Python
Si tienes Python instalado, puedes levantar un servidor rápido. En tu terminal ejecuta:
```bash
python -m http.server
```
Luego entra a `http://localhost:8000` en tu navegador.

## Información de la Institución

- **Instituto:** Instituto de Estudios Superiores Nuevo Cuyo PT-169
- **Ubicación:** La Rioja 614, Ciudad de Mendoza, Argentina
- **Contacto:** (+054) 261 6271658
