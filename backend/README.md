# ChatSphere AI - Backend Service

This is the backend service for **ChatSphere AI**, a real-time, AI-powered chat and collaboration application. Built with **FastAPI** and **Python**, it leverages asynchronous programming, WebSockets, and state-of-the-art AI integration.

## Key Features
- **FastAPI Framework**: High performance, modern, and auto-documenting REST APIs.
- **Real-Time WebSockets**: Handles state synchronization, presence tracking, typing indicators, and message broadcasts.
- **Google Gemini AI Integration**: Auto-suggests smart replies, generates summarized chat transcripts, translates messages, and responds to `@AI` bot queries asynchronously.
- **Firebase Auth Support**: Verifies Firebase Client ID tokens and maps them to custom application session JWTs. Includes a convenient local bypass for testing.
- **Relational Database**: Uses **SQLAlchemy ORM** to connect to SQLite locally (for zero-setup dev) and Neon DB/PostgreSQL in production.

---

## Directory Layout
```
backend/
├── app/
│   ├── api/             # APIRouters defining REST endpoints
│   │   ├── auth.py          # Firebase token exchange & standard JWT logins
│   │   ├── users.py         # User profiles and global search
│   │   ├── friends.py       # Friendship lifecycle (requests, accepts, blocks)
│   │   ├── chats.py         # Direct Messages (DMs) and group chat management
│   │   ├── messages.py      # Messaging API & asynchronous AI actions
│   │   ├── notifications.py # Client workspace toast/banner notification logs
│   │   └── ai.py            # Custom Gemini endpoints (summarization, translate, replies)
│   ├── core/            # Core utilities and business logic services
│   │   ├── auth.py          # Dependency injection hooks for user verification
│   │   ├── security.py      # JWT encoding, decoding, and password hashing
│   │   ├── websocket.py     # Connection manager & active connection maps
│   │   └── gemini.py        # Gemini API client wrapper and prompting templates
│   ├── models/          # Declarative SQLAlchemy Database Models
│   ├── schemas/         # Pydantic Schemas for validation and serialization
│   ├── config.py        # Settings configuration parsing Environment Variables
│   ├── database.py      # SQLAlchemy setup & session yield dependencies
│   └── main.py          # FastAPI application initialization & WebSocket gateway
├── tests/               # Pytest unit & integration tests
├── requirements.txt     # Python backend dependencies
└── chatsphere.db        # Default SQLite database file (auto-generated)
```

---

## Local Setup & Configuration

### Prerequisites
- Python 3.10 or higher
- Pip (Python Package Installer)

### 1. Installation
Navigate to the `backend/` directory and install the required packages:
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` directory. You can copy the structure below:
```env
# Database Configuration (Leave blank to use the default local SQLite db)
DATABASE_URL=postgresql://user:pass@ep-neon-db-id.postgres.neon.tech/chatsphere?sslmode=require

# JWT Secret Key (Keep this secret and random!)
JWT_SECRET_KEY=generate_a_random_jwt_hash_here

# Firebase Configuration
# Absolute path to your Firebase service account credentials JSON file
FIREBASE_CREDENTIALS_PATH=C:/path/to/firebase-adminsdk-key.json
# Set to True to bypass Firebase auth verify against external servers for simple local runs
DEV_BYPASS_FIREBASE=True

# Google Gemini API Configuration
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
```

### 3. Running the Server
Start the development server with hot-reload enabled:
```bash
uvicorn backend.app.main:app --reload --port 8000
```
- **REST API Docs**: Swagger UI is available at [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: Alternative docs at [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Running Backend Tests
The project uses `pytest` for automated test coverage:
```bash
# Run tests inside the root directory or backend directory
python -m pytest backend/tests
```

---

## Core Technologies Used
1. **FastAPI**: API validation and JSON parsing via Pydantic v2.
2. **SQLAlchemy v2.0**: Modern declarative ORM patterns.
3. **Uvicorn**: Asynchronous ASGI server.
4. **Google Generative AI**: Client SDK to invoke the `gemini-1.5-flash` model.
5. **Firebase Admin SDK**: Performs backend-side token verifications.
6. **Pytest**: Lightweight test runner with fixture configurations.
