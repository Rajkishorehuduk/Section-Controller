# Section Controller

A modern web application for managing and reporting on railway section decisions, track closures, and occupancy. Built with React, TypeScript, Vite, and Tailwind CSS.

## Features
- Section decision management
- Track closure reporting
- Occupancy tracking
- Modern UI components (accordion, dialog, table, toast, etc.)
- Built with Vite for fast development
- Tailwind CSS for styling
- Modular code structure (client, server, shared)

## Project Structure
```
├── client/         # Frontend React app
│   ├── App.tsx
│   ├── global.css
│   ├── components/ # UI and feature components
│   ├── hooks/      # Custom React hooks
│   ├── lib/        # Utility functions
│   └── pages/      # Page components
├── server/         # Backend API (Node.js/Express)
│   ├── index.ts
│   ├── node-build.ts
│   └── routes/     # API routes
├── shared/         # Shared code (API types, utils)
├── public/         # Static assets
├── index.html      # Main HTML file
├── package.json    # Project metadata and scripts
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts  # Vite configuration
└── README.md       # Project documentation
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or pnpm

### Installation
1. Clone the repository:
   ```powershell
   git clone <repo-url>
   cd Section-Controller-main
   ```
2. Install dependencies:
   ```powershell
   npm install
   # or
   pnpm install
   ```

### Development
Start the development server:
```powershell
npm run dev
```
The app will be available at `http://localhost:5173` (default Vite port).

### Build
To build for production:
```powershell
npm run build
```

### Linting
To lint the codebase:
```powershell
npm run lint
```

## Configuration
- **Tailwind CSS**: See `tailwind.config.ts` and `postcss.config.js` for styling configuration.
- **Vite**: See `vite.config.ts` for build and dev server settings.
- **API**: Backend routes are in `server/routes/`.

## Deployment
- The project includes a `netlify.toml` for Netlify deployment.
- Static assets are in the `public/` directory.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://allcontributors.org) specification. Contributions of any kind are welcome! To add yourself, comment on a PR or issue with:

```
@All-Contributors please add <username> for <contribution-type>
```

Or use the [All Contributors bot](https://allcontributors.org/docs/en/bot/usage) for automatic updates.
