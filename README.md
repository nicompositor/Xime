# Xime y la familia

Tablero familiar, pensado primero para celular, para coordinar el acompañamiento y los cuidados de Xime.

## Lo que incluye

- Turno actual con una o varias personas entre Nel, Santi, Nico, Aida, Chary, Pau, Fabio u Otro.
- Hora de finalización del turno e indicador verde de quién está con Xime.
- Turno nocturno separado debajo de los nombres, con una o varias personas asignadas.
- Campo para escribir el nombre real cuando se elige “Otro”.
- Agenda diaria con calendario, navegación al día siguiente y planificación de turnos futuros.
- La página siempre abre mostrando el día de hoy.
- Estado de ánimo con emojis y una nota breve.
- Control de radioterapia y quimioterapia.
- Registro de medicinas, dosis, hora y persona que actualizó.
- Comentarios y novedades familiares.
- Actualización en tiempo real desde varios celulares mediante Firebase.

Sin configurar Firebase, la página funciona en **modo de prueba local**. En ese modo los datos solo se guardan en el dispositivo actual.

## 1. Activar la sincronización entre celulares

1. Entra a [Firebase Console](https://console.firebase.google.com/) e inicia sesión con una cuenta de Google.
2. Pulsa **Crear un proyecto** y llámalo, por ejemplo, `xime-familia`.
3. Dentro del proyecto, abre **Compilación > Realtime Database**, pulsa **Crear base de datos** y elige una ubicación. Inicia en modo bloqueado.
4. En **Configuración del proyecto > General**, pulsa el icono web `</>` para registrar una app web.
5. Firebase mostrará un objeto `firebaseConfig`. Copia sus valores en `firebase-config.js`.
6. En **Realtime Database > Reglas**, reemplaza el contenido con el de `database.rules.json` y pulsa **Publicar**.

> Importante: estas reglas permiten leer y editar a cualquiera que tenga la dirección. Eso coincide con el funcionamiento solicitado, pero la URL no debe compartirse fuera de la familia porque contiene información de salud. Las claves del objeto `firebaseConfig` no son contraseñas; Firebase espera que sean públicas.

## 2. Publicar gratis en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `xime-y-la-familia`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En el repositorio, abre **Settings > Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `main`, carpeta `/ (root)`, y pulsa **Save**.
6. En unos minutos GitHub mostrará la dirección pública, normalmente `https://TU-USUARIO.github.io/xime-y-la-familia/`.

## Probar en el computador

Por usar módulos web, conviene abrirla con un servidor local:

```bash
python3 -m http.server 8080
```

Después visita `http://localhost:8080`.

## Privacidad

GitHub Pages es público. Evita escribir números de historia clínica, documentos, teléfonos, diagnósticos detallados u otra información especialmente sensible. Para acceso con contraseña real hace falta agregar autenticación, lo cual es recomendable si la familia necesita mayor privacidad.
