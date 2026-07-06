---
title: Chatsphere
emoji: 👁
colorFrom: red
colorTo: gray
sdk: docker
pinned: false
---

# ChatSphere AI - Production-Ready Real-Time Chat Application

ChatSphere AI is a modern WhatsApp/Discord-style real-time collaboration platform featuring private DMs, group chats, file sharing, voice recording, presence tracking, and AI-powered interactions (powered by Google Gemini). 

This project is built using a highly scalable, secure, and decoupled architecture with a FastAPI (Python) backend and a React (Vite) frontend.

---

## Table of Contents
1. [Architecture Diagram](#architecture-diagram)
2. [Folder Structure](#folder-structure)
3. [Database Schema & ER Diagram](#database-schema--er-diagram)
4. [API Documentation](#api-documentation)
5. [WebSocket Protocol Specification](#websocket-protocol-specification)
6. [Firebase & Gemini AI Configuration](#firebase--gemini-ai-configuration)
7. [Local Setup & Development Guide](#local-setup--development-guide)
8. [Production Deployment Guide](#production-deployment-guide)

---

## Architecture Diagram

This diagram visualizes the decoupled data flows, state sync paths, and socket connection gateways:

```mermaid
graph TD
    %% Clients
    subgraph Client App (React + Zustand)
        F[Frontend UI Components]
        Z[Zustand Stores]
        WS_C[WebSocket client]
        FA_SDK[Firebase client SDK]
    end

    %% Servers
    subgraph Cloud Backend (FastAPI + Gunicorn)
        B[FastAPI REST Router]
        WS_S[WebSocket Manager]
        A_M[Auth Middleware]
        G_S[Gemini AI Service]
    end

    %% Third Party Cloud
    subgraph Cloud Infrastructure
        FB_A[Firebase Auth]
        FB_S[Firebase Storage]
        GEM[Google Gemini AI API]
        NEON[PostgreSQL - Neon DB]
    end

    %% Direct Flows
    F -->|Interacts| Z
    F -->|Direct Media Uploads| FB_S
    FA_SDK -->|Auth Credentials| FB_A
    FA_SDK -->|Acquires ID Token| F
    F -->|REST HTTP Requests| B
    B -->|Verifies Token| A_M
    A_M -->|Verifies against Claims| FB_A
    WS_C <-->|Bi-directional WS Events| WS_S
    WS_S -->|Broadcasts Status / Typing / Messages| WS_C
    B -->|Read/Write Operations| NEON
    WS_S -->|Updates status / saves messages| NEON
    B -->|Background Assistant / Suggestion prompts| G_S
    G_S <-->|API Calls| GEM
```

---

## Folder Structure

For module-specific implementation and setup details, please refer to:
- [Backend Documentation](file:///d:/Chat%20Application/backend/README.md)
- [Frontend Documentation](file:///d:/Chat%20Application/frontend/README.md)

```
d:\Chat Application
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI entrypoint, middleware, WS routes
│   │   ├── config.py           # Configuration loads (dot-env, defaults)
│   │   ├── database.py         # SQLAlchemy engine, session maker, base
│   │   ├── models/             # Database Declarative Models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── friendship.py
│   │   │   ├── chat.py
│   │   │   ├── message.py
│   │   │   ├── notification.py
│   │   │   └── ai.py
│   │   ├── schemas/            # Pydantic Schemas for validation
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── friendship.py
│   │   │   ├── chat.py
│   │   │   ├── message.py
│   │   │   ├── notification.py
│   │   │   ├── token.py
│   │   │   └── ai.py
│   │   ├── api/                # APIRouters
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── friends.py
│   │   │   ├── chats.py
│   │   │   ├── messages.py
│   │   │   ├── notifications.py
│   │   │   └── ai.py
│   │   └── core/               # Core middleware, WebSocket and Gemini services
│   │       ├── auth.py
│   │       ├── security.py
│   │       ├── websocket.py
│   │       └── gemini.py
│   ├── tests/                  # Pytest Unit & Integration Tests
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_friends.py
│   │   └── test_messages.py
│   └── requirements.txt        # Backend dependencies
└── frontend/
    ├── src/
    │   ├── main.jsx            # React mount entry
    │   ├── App.jsx             # Routes & Context wraps
    │   ├── index.css           # Styling sheet (Tailwind v4 imports & scrollbars)
    │   ├── config/
    │   │   └── firebase.js     # Firebase client SDK initialization
    │   ├── context/
    │   │   ├── AuthContext.jsx # Auth state, Firebase exchanges & DB bypass
    │   │   └── SocketContext.jsx # WS handlers, emitters, and auto-reconnects
    │   ├── store/
    │   │   ├── chatStore.js    # Zustand store (chats, messages, online list)
    │   │   └── notificationStore.js # Zustand store (workspace alert logs)
    │   └── pages/
    │       ├── Login.jsx       # Login layout card
    │       ├── Register.jsx    # Registration layout card
    │       └── Dashboard.jsx   # master Chat panel workspace
    ├── tailwind.config.js      # Tailwind configurations
    ├── postcss.config.js       # PostCSS plugins registering new Tailwind v4
    ├── package.json            # Node.js dependencies
    └── vite.config.js          # Vite configurations
```

---

## Database Schema & ER Diagram

The database utilizes **PostgreSQL (Neon DB)** in production with **UUIDs** for all identifiers.

### ER Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        string firebase_uid UK
        string username UK
        string email UK
        string hashed_password
        string profile_photo
        string status
        timestamp last_seen
        timestamp created_at
    }
    friendships {
        uuid id PK
        uuid sender_id FK
        uuid receiver_id FK
        string status
        timestamp created_at
        timestamp updated_at
    }
    chats {
        uuid id PK
        boolean is_group
        string name
        text description
        text icon_url
        uuid created_by FK
        timestamp created_at
    }
    chat_members {
        uuid id PK
        uuid chat_id FK
        uuid user_id FK
        string role
        timestamp joined_at
    }
    messages {
        uuid id PK
        uuid chat_id FK
        uuid sender_id FK
        text content
        string message_type
        text file_url
        string file_name
        integer file_size
        boolean is_seen
        timestamp seen_at
        timestamp created_at
    }
    notifications {
        uuid id PK
        uuid user_id FK
        string type
        string title
        text content
        boolean is_read
        uuid reference_id
        timestamp created_at
    }
    ai_history {
        uuid id PK
        uuid chat_id FK
        uuid user_id FK
        text query
        text response
        timestamp created_at
    }

    users ||--o{ friendships : "sends/receives"
    users ||--o{ chat_members : "belongs_to"
    users ||--o{ messages : "sends"
    users ||--o{ notifications : "receives"
    users ||--o{ ai_history : "queries"
    chats ||--o{ chat_members : "has"
    chats ||--o{ messages : "contains"
    chats ||--o{ ai_history : "logs"
```

---

## API Documentation

All routes are prefixed with `/api`. Authenticated requests require the Header `Authorization: Bearer <session_jwt_token>`.

### 1. Authentication (`/auth`)
* `POST /auth/register`: Create a standard user with credentials.
* `POST /auth/login`: Authenticate with email/password.
* `POST /auth/verify`: Accepts Firebase client ID token, auto-creates database user profile, returns backend custom JWT.
* `GET /auth/me`: Fetch profile of the logged-in user.

### 2. User Profiles & Search (`/users`)
* `PUT /users/profile`: Edit username, status indicator, or profile photo.
* `GET /users/search?q=<keyword>`: Partial/exact match on username/email. Resolves friend request states (`sent_pending`, `received_pending`, `accepted`, `blocked`).
* `GET /users/{user_id}`: Fetch public info of a user.

### 3. Friendships (`/friends`)
* `POST /friends/request`: Send a request. Takes `{"receiver_username_or_email": "..."}`.
* `POST /friends/respond`: Respond with action (`accept`, `reject`, `block`, `unblock`). Accepting automatically provisions a Direct Message chat.
* `GET /friends/list`: Retrieve friends list.
* `GET /friends/requests/pending`: Retrieve received friend requests.

### 4. Chats & Groups (`/chats`)
* `GET /chats`: List all user chats, enriched with the last message, unread counters, and other member presence details.
* `POST /chats/group`: Create group. Takes name, desc, icon, and member IDs.
* `PUT /chats/group/{chat_id}`: Modify group settings (admin-only).
* `POST /chats/group/{chat_id}/members?user_id=...`: Add a member (admin-only).
* `DELETE /chats/group/{chat_id}/members/{user_id}`: Remove a member or leave.

### 5. Messages (`/messages`)
* `POST /messages`: Send message (text, image, file, voice). Triggers asynchronous background task if message starts with `@AI`.
* `GET /messages?chat_id=...`: Fetch page-paginated history.
* `POST /messages/seen/{chat_id}`: Mark all unread messages as read.
* `DELETE /messages/{message_id}`: Delete message.

### 6. AI Assistant & Utility Features (`/ai`)
* `GET /ai/suggestions?chat_id=...`: Fetches last 5 messages, returns 3 smart suggestions.
* `GET /ai/summary?chat_id=...`: Fetches last 50 messages, returns summary bullet list.
* `POST /ai/translate`: Translates text body. Requires text and target code (`en`, `hi`, `te`).

---

## WebSocket Protocol Specification

All WS connections route to `ws://localhost:8000/ws?token=<session_jwt_token>`.

### Client Event Triggers
1. **Typing Start** (`typing_start`)
   ```json
   { "event": "typing_start", "data": { "chat_id": "UUID" } }
   ```
2. **Typing Stop** (`typing_stop`)
   ```json
   { "event": "typing_stop", "data": { "chat_id": "UUID" } }
   ```
3. **Mark Seen** (`mark_seen`)
   ```json
   { "event": "mark_seen", "data": { "chat_id": "UUID" } }
   ```

### Server Broadcast Events
1. **New Message** (`receive_message`)
   Broadcast to all members of the chat. Includes sender names, attachment fields, and timestamp.
2. **Typing Update** (`typing_update`)
   Broadcast to all chat members when someone starts or stops.
3. **Status Update** (`status_update`)
   Broadcast to all friends when a user logs on (`online`) or off (`offline`).
4. **Message Read** (`messages_seen`)
   Broadcast when a member reads message history.

---

## Firebase & Gemini AI Configuration

To configure the external integrations, create a `.env` file inside the `backend` directory.

### Environment variables (`backend/.env`)
```env
# Database Settings (Leave empty to use local SQLite)
DATABASE_URL=postgresql://user:pass@ep-neon-db-id.postgres.neon.tech/chatsphere?sslmode=require

# JWT Configuration
JWT_SECRET_KEY=generate_a_random_jwt_hash_here

# Firebase Configuration
# Path to your downloaded Service Account JSON credentials
FIREBASE_CREDENTIALS_PATH=C:/path/to/firebase-adminsdk-key.json
DEV_BYPASS_FIREBASE=False # Set to True to bypass Firebase auth check locally

# Google Gemini API Configuration
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
```

### Environment variables (`frontend/.env`)
Create a `.env` file inside `frontend/` directory to configure the Firebase Web Client SDK:
```env
VITE_FIREBASE_API_KEY=AIzaSyFirebaseWebApiKey
VITE_FIREBASE_AUTH_DOMAIN=chatsphere-ai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chatsphere-ai
VITE_FIREBASE_STORAGE_BUCKET=chatsphere-ai.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234:web:abcd
```

---

## Local Setup & Development Guide

### 1. Backend Server Setup
Ensure Python 3.10+ is installed on your system.
```bash
# Navigate to backend folder
cd backend

# Install dependencies (on Windows, dependencies use precompiled wheels)
pip install -r requirements.txt

# Run server (automatic migrations and seeding will run)
uvicorn backend.app.main:app --reload --port 8000
```
The FastAPI documentation will be instantly accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Run Backend Tests
Ensure the server is stopped or clean environment holds:
```bash
python -m pytest backend/tests
```

### 3. Frontend Client Setup
Ensure Node.js 18+ is installed.
```bash
# Navigate to frontend folder
cd frontend

# Install Node modules
npm install

# Start Vite hot-reload server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Production Deployment Guide

### 1. Database Deployment (Neon DB)
1. Register for a free tier database at [Neon.tech](https://neon.tech/).
2. Create a project and select PostgreSQL v15 or v16.
3. Retrieve your connection string from the Dashboard.
4. Supply this connection string as the `DATABASE_URL` env variable in the Render environment settings.

### 2. Deployment on Render

Render deployment is automated using the [render.yaml](file:///d:/Chat%20Application/render.yaml) blueprint specification in the project root.

#### Option A: Blueprint Deployment (Recommended & Automatic)
1. Register/Login at [Render](https://render.com/).
2. In the dashboard, click **New +** and select **Blueprint**.
3. Connect your code repository.
4. Render automatically parses [render.yaml](file:///d:/Chat%20Application/render.yaml) to declare:
   - `chatsphere-backend` (FastAPI Web Service)
   - `chatsphere-frontend` (Vite Static Site)
5. Enter the necessary environment variables (`DATABASE_URL`, `GEMINI_API_KEY`, Firebase web client variables) in the configuration screen and click **Apply**.

#### Option B: Manual Backend Deployment
1. Click **New +** and select **Web Service**.
2. Connect your repository.
3. Set the following settings:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r backend/requirements.txt && pip install psycopg2-binary`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. Expand **Advanced** and declare the following variables:
   - `DATABASE_URL`: Your database connection string.
   - `JWT_SECRET_KEY`: A secure random hash key.
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `DEV_BYPASS_FIREBASE`: Set to `True` to use database-only credentials without Firebase check.

### 3. Frontend Deployment (Firebase Hosting)
1. Install Firebase CLI globally: `npm install -g firebase-tools`.
2. Login to Google/Firebase: `firebase login`.
3. Initialize hosting in the `frontend` folder: `firebase init hosting`.
   - Select your project.
   - Set the public directory to `dist` (Vite's build output folder).
   - Configure as a single-page app (write `y` to rewrite all URLs to `index.html`).
4. Build the production build: `npm run build`.
5. Deploy: `firebase deploy --only hosting`.
Your application is now hosted and production-ready!
