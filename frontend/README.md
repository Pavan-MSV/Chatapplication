# ChatSphere AI - Frontend Client

This is the web client application for **ChatSphere AI**, a modern, responsive, real-time collaboration application. Built with **React** (bootstrapped with **Vite**), it uses modern state management patterns, Tailwind CSS v4 for clean layout design, and connects to the backend REST and WebSocket APIs.

## Key Features
- **Modern User Experience**: A beautiful, premium interface leveraging HSL colors, responsive layouts, glassmorphic card patterns, custom styled scrollbars, and dark/light modes.
- **Real-Time Client**: Bi-directional event integration via WebSockets for typing notifications, user presence changes, and message deliveries.
- **Robust Authentication**: Supports standard login/registration flows, integration with Firebase Client SDK, and automatic exchange for session tokens.
- **Zustand State Stores**: Light, lightning-fast stores to decouple message logs, user lists, active chat selections, and system alert states.
- **AI Assist Panels**: Built-in panels to view translation suggestions, smart prompt options, and quick summarized bullets.

---

## Directory Structure
```
frontend/
├── src/
│   ├── config/
│   │   └── firebase.js     # Firebase client configuration & app initialization
│   ├── context/
│   │   ├── AuthContext.jsx # Context for Firebase logins, local JWT exchange, user sessions
│   │   └── SocketContext.jsx # Handles WebSocket connection, reconnect loops, and events
│   ├── store/
│   │   ├── chatStore.js    # Zustand store managing chats, messages, online presence lists
│   │   └── notificationStore.js # Zustand store managing system warnings and success notices
│   ├── pages/
│   │   ├── Login.jsx       # Login layout card (with toggle for password, email checks)
│   │   ├── Register.jsx    # Registration layout card
│   │   └── Dashboard.jsx   # Master layout, chat lists, chat body, member panels, AI panel
│   ├── App.jsx             # React Routes config & Route Guards
│   ├── index.css           # Styling sheet (Tailwind v4 imports & custom CSS scrollbars)
│   └── main.jsx            # Main index mount point
├── tailwind.config.js      # Custom theme mappings
├── postcss.config.js       # PostCSS plugins registering Tailwind CSS v4
├── package.json            # Node project metadata & dependency definitions
└── vite.config.js          # Vite custom build config
```

---

## Local Setup & Configuration

### Prerequisites
- Node.js 18 or higher
- NPM or Yarn package manager

### 1. Installation
Navigate to the `frontend/` directory and install the package dependencies:
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `frontend/` directory with your Firebase configuration variables:
```env
VITE_FIREBASE_API_KEY=AIzaSyFirebaseWebApiKey
VITE_FIREBASE_AUTH_DOMAIN=chatsphere-ai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chatsphere-ai
VITE_FIREBASE_STORAGE_BUCKET=chatsphere-ai.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234:web:abcd
```

### 3. Start Development Server
Run Vite's fast hot-reload server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
To build a static production bundle:
```bash
npm run build
```
The output files will be built inside the `dist/` directory, ready to be hosted on Firebase Hosting, Netlify, Vercel, or similar static servers.

---

## Tech Stack Overview
1. **React v19**: Core UI component architecture.
2. **Vite**: Ultra-fast bundler and compilation engine.
3. **Tailwind CSS v4 & PostCSS**: Custom theme designs, glassmorphism, responsive grid systems.
4. **Zustand**: Clean, reactive state management.
5. **React Router DOM v7**: Seamless single-page routing with session guards.
6. **Lucide React**: Vector icon package.
7. **Firebase Web SDK**: Handles client authentication and media storage uploads.
