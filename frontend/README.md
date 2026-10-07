# Mietubl POS – Frontend

A React + TypeScript frontend scaffolded with Vite. It uses MUI for UI components and Chart.js for data visualization.

## Tech stack
- Vite 5 • React 18 • TypeScript
- MUI (@mui/material, @mui/icons-material)
- Chart.js + react-chartjs-2
- Formik + Yup

## Prerequisites
- Node.js 18+ (LTS recommended). Vite 5 requires Node 18.0+.
- npm (comes with Node). You can use pnpm/yarn if preferred.

## Getting started
```bash
# 1) Install dependencies
npm install

# 2) Create a .env file at the project root and set your variables
# (see the example block below)

# 3) Start the dev server
npm run dev
```
The dev server runs on http://localhost:5173 by default.

### Environment variables
This project is built with Vite. All client-exposed variables must start with `VITE_`.
Common example you may need:

```bash
# .env
# Optional. Leave unset when the frontend and API share a domain.
VITE_API_URL=/api
```

The Vite development server proxies `/api` requests to the backend on port 4000.

## Available scripts
These are defined in `package.json` and can be run with `npm run <script>`.

- `dev` – Start Vite dev server.
- `build` – Build the app for production.
- `preview` – Preview the production build locally.

## Building
```bash
npm run build
```
The production build is output to `dist/`.

## Previewing a production build
```bash
npm run preview
```

## Contributing
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for our workflow, branch naming, and PR guidelines.