# Zaza.click 2.0 - WhatsApp API SaaS

Plataforma SaaS para administrar y vender accesos a la API de WhatsApp (Evolution API).

## Estructura del Proyecto

```
├── backend/     # API REST (Node.js + Express + TypeScript + PostgreSQL)
└── frontend/    # Panel Web (React + Vite + TypeScript)
```

## Inicio Rápido

### Backend
```bash
cd backend
npm install
cp .env.example .env   # Editar con tus credenciales reales
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables de Entorno del Backend

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default: 5000) |
| `DATABASE_URL` | URL de conexión a PostgreSQL (Neon/Supabase/Railway) |
| `JWT_SECRET` | Clave secreta para firmar tokens de sesión |
| `EVOLUTION_API_URL` | URL base de tu servidor Evolution API |
| `EVOLUTION_API_KEY` | API Key global de tu servidor Evolution API |

## Licencia
Privado - Todos los derechos reservados.
