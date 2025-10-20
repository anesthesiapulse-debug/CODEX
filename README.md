# Planificador Pomodoro

Aplicación web estática para organizar tareas y sesiones Pomodoro con agrupaciones por grupo, subgrupo y etiquetas.

## Cómo ejecutarlo

1. Clona este repositorio o descarga los archivos.
2. Abre `index.html` directamente en tu navegador **o** levanta un servidor estático simple:
   ```bash
   python -m http.server 8000
   ```
   Luego visita [http://localhost:8000/index.html](http://localhost:8000/index.html).

No se necesitan dependencias adicionales: todo el comportamiento está implementado con HTML, CSS y JavaScript sin frameworks.

## Persistencia de datos

La aplicación guarda tus tareas y estadísticas en `localStorage`. Si tu navegador bloquea ese almacenamiento (por ejemplo en navegación privada), verás una alerta dentro de la página indicando que los cambios sólo se conservarán mientras la pestaña esté abierta.
