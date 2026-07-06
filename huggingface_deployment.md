# Deploying ChatSphere AI on Hugging Face Spaces

This guide walks you through migrating the deployment from Render to **Hugging Face Spaces**. 

By using the **Docker SDK** on Hugging Face, we can package both the FastAPI backend and the React frontend into a single, unified Space. This simplifies routing, eliminates CORS issues, and hosts the entire application on Hugging Face's free tier.

---

## What We Have Configured for You

We have already updated and created the necessary files in your repository:
1. **[api.js](frontend/src/config/api.js)**: Configured to support relative paths. It automatically detects the Hugging Face Space URL at runtime and routes WebSocket/API calls to the same origin.
2. **[run_hf.py](run_hf.py)**: A new launcher script that mounts the compiled React frontend directly to the FastAPI server and handles client-side (SPA) routing fallbacks (e.g. `/login`, `/dashboard`).
3. **[Dockerfile](Dockerfile)**: A multi-stage Docker build file that:
   - Compiles the React frontend.
   - Sets up Python 3.10 and installs backend requirements.
   - Copies the frontend assets into the backend space.
   - Runs the unified application on port `7860` (the default port required by Hugging Face Spaces).

---

## Step-by-Step Deployment Instructions

### Step 1: Create a Hugging Face Space

1. Log in to [Hugging Face](https://huggingface.co/). If you do not have an account, sign up.
2. Navigate to your Profile icon (top right) and click **New Space**.
3. Fill out the creation form:
   - **Space Name**: e.g., `chatsphere-ai`
   - **License**: Choose any (e.g., `mit` or `apache-2.0`)
   - **SDK**: Select **Docker** (Crucial: do not choose Static, Streamlit, or Gradio)
   - **Docker Template**: Select **Blank**
   - **Space Hardware**: Choose **CPU basic (Free)**
   - **Visibility**: **Public** (recommended for testing) or **Private**

Click **Create Space** at the bottom.

---

### Step 2: Configure Environment Variables (Variables and Secrets)

Hugging Face Spaces hide sensitive credentials like database passwords and API keys from the public view.

1. In your newly created Space, click the **Settings** tab.
2. Scroll down to the **Variables and secrets** section.
3. Click **New secret** to add each of the following:

| Name | Type | Description |
|---|---|---|
| `DATABASE_URL` | Secret | Your Neon DB / PostgreSQL connection string. |
| `JWT_SECRET_KEY` | Secret | A secure random string (e.g., `openssl rand -hex 32`) to sign session tokens. |
| `GEMINI_API_KEY` | Secret | Your Google Gemini API Key for AI suggestions/assistance. |
| `DEV_BYPASS_FIREBASE` | Secret / Variable | Set to `True` to bypass Firebase authentication verification (uses local DB credentials). Set to `False` to enforce Firebase verification. |
| `FIREBASE_CREDENTIALS_PATH` | Secret | *(Optional)* Only required if `DEV_BYPASS_FIREBASE` is set to `False`. |

---

### Step 3: Push Code to Hugging Face Spaces

Hugging Face Spaces act as standard Git remotes. You can push your code directly to Hugging Face:

1. Copy the Git URL of your Space. It will look like:
   `https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME`
2. Open a terminal in your local project root (`d:\Chat Application`) and run:
   ```bash
   # Add Hugging Face Space as a git remote named 'hf'
   git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME

   # Stage all new deployment files
   git add Dockerfile run_hf.py frontend/src/config/api.js

   # Commit changes
   git commit -m "Configure Docker build for Hugging Face Spaces"

   # Push to Hugging Face (forces deployment start)
   git push hf main
   ```
   *(Note: You may be prompted to enter your Hugging Face credentials. Use your username and a generated **User Access Token** with write access as the password. You can create one under settings on HF).*

---

### Step 4: Monitor the Build & Verify

1. Go to the **App** tab on your Space's page on Hugging Face.
2. You will see building logs. Docker will pull the dependencies, compile the frontend assets, set up the FastAPI server, and deploy it.
3. Once the build status turns green and says **Running**:
   - The application UI will be displayed directly within the Hugging Face iframe.
   - You can access the app full-screen by clicking the **Embed** dropdown (three dots on top right) and selecting **Direct URL**.
   - The URL will look like `https://YOUR-USERNAME-YOUR-SPACE-NAME.hf.space`.

---

## Key Differences from Render

* **Port Mapping**: Hugging Face Spaces route incoming traffic from port 80/443 automatically to port **`7860`** inside your container.
* **Ephemeral Storage**: Like Render free tiers, any local file storage (like local SQLite files) will be reset when the container restarts. Ensure you are using your Neon PostgreSQL Database (`DATABASE_URL`) to persist messages and user accounts.
* **Unified Domain**: Because the frontend and backend are served by the same port on the same server, WebSocket handshakes and API queries will route automatically without needing to declare custom backend hostnames on the client side.
