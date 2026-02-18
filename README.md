<br/>
<div align="center">
  <a href="https://www.devasign.com?ref=github" style="display: block; margin: 0 auto;">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./packages/mobile/public/devasign-white.png">
      <source media="(prefers-color-scheme: light)" srcset="./packages/mobile/public/devasign-black.png">
      <img alt="DevAsign Logo" src="./packages/mobile/public/devasign-white.png" height="80" style="display: block; margin: 0 auto;">
    </picture>
  </a>
<br/>

<br/>
</div>
<br/>

<div align="center">
    <a href="https://github.com/devasignhq/contributor-app?tab=Apache-2.0-1-ov-file">
  <img src="https://img.shields.io/github/license/devasignhq/contributor-app" alt="License">
<a href="https://GitHub.com/devasignhq/contributor-app/graphs/contributors">
  <img src="https://img.shields.io/github/contributors/devasignhq/contributor-app" alt="GitHub Contributors">
</a>
<a href="https://devasign.com">
  <img src="https://img.shields.io/badge/Visit-devasign.com-orange" alt="Visit devasign.com">
</a>
</div>
<div>
  <p align="center">
    <a href="https://x.com/devasign">
      <img src="https://img.shields.io/badge/Follow%20on%20X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X" />
    </a>
    <a href="https://www.linkedin.com/company/devasign">
      <img src="https://img.shields.io/badge/Follow%20on%20LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="Follow on LinkedIn" />
    </a>
  </p>
</div>


<div align="center">
  
  **Join our stargazers :)** 

  <a href="https://github.com/devasignhq/contributor-app">
    <img src="https://img.shields.io/github/stars/devasignhq?style=social&label=Star&maxAge=2592000" alt="GitHub stars">
  </a>

  </div>

## DevAsign Mobile App

DevAsign Mobile App is a modern, mobile-first web application designed for developers to discover opportunities, manage tasks, and track earnings on the go. Built with React and TypeScript, it provides a seamless experience for navigating the DevAsign ecosystem.

### Features

- **Task Explorer**: Browse available bounties and development tasks.
- **Task Management**: Track your active and completed tasks in one place.
- **Bounty Details**: View detailed information about bounties, including requirements and rewards.
- **Submission System**: Submit your work directly through the app and view submission status.
- **Wallet & Earnings**: Monitor your earnings, view transaction history, and manage your wallet.
- **In-App Messaging**: Communicate with task creators and other developers.
- **Notifications**: Stay updated with real-time alerts for task updates and messages.
- **User Profile**: manageable profile and settings.

### Tech Stack

- **Framework**: [React](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Styling**: Vanilla CSS with a custom design system
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

### Getting Started

Follow these steps to set up and run the project locally.

#### Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm
- Docker and Docker Compose (for local database and redis)

#### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bishopBethel/devasign-mobile-app.git
   cd devasign-mobile-app
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up the development environment (Postgres & Redis):
   ```bash
   docker compose up -d
   ```

To stop the development environment:
   ```bash
   docker compose down
   ```

#### Environment Configuration

This project uses `.env` files for configuration. Create the following files based on their examples:
- **Root `.env`**: For Docker variables like `POSTGRES_USER`, `POSTGRES_PASSWORD`, etc.
- **`packages/api/.env`**: For API-specific variables like `DATABASE_URL` and `GEMINI_API_KEY`.

In `packages/api/.env`, you should construct the `DATABASE_URL` using the same values you set for `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in your root `.env` file.

#### Running the App

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in your terminal).

## Building for Production

To build the application for production:

```bash
npm run build
```

This will generate the optimized files in the `dist` directory.
