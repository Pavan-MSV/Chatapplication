import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if it exists
dotenv_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

class Settings:
    # App General Settings
    PROJECT_NAME: str = "ChatSphere AI"
    API_V1_STR: str = "/api"
    
    # Security & JWT Session
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super_secret_chatsphere_key_change_me_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week session
    
    # Database Settings (Fallback to local SQLite if Neon DB not provided)
    # Default SQLite file inside backend directory
    DEFAULT_DB_FILE: Path = Path(__file__).resolve().parent.parent / "chatsphere.db"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"
    )
    
    # Firebase Settings
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    # Toggle to bypass Firebase validation for simple local evaluation/tests
    DEV_BYPASS_FIREBASE: bool = os.getenv("DEV_BYPASS_FIREBASE", "True").lower() in ("true", "1", "t")
    
    # Gemini API Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # SMTP Email Settings
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")

settings = Settings()
