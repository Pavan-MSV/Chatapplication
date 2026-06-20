from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.app.config import settings

# Configure database URL arguments
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Create all tables if they don't exist
    from backend.app.models import Base, User
    Base.metadata.create_all(bind=engine)
    
    # Auto-migration: Check and add new columns to users table if they are missing
    db = SessionLocal()
    try:
        for col_name, col_type in [
            ("is_verified", "BOOLEAN DEFAULT TRUE"),
            ("otp_code", "VARCHAR"),
            ("otp_expires_at", "TIMESTAMP")
        ]:
            try:
                db.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                db.commit()
                print(f"Migration: Added column {col_name} to users table.")
            except Exception:
                db.rollback()  # Silent rollback if column already exists
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        db.close()

    # Seed AI Assistant user
    db = SessionLocal()
    try:
        ai_user_id = "00000000-0000-0000-0000-000000000000"
        ai_user = db.query(User).filter(User.id == ai_user_id).first()
        if not ai_user:
            ai_user = User(
                id=ai_user_id,
                username="AI Assistant",
                email="ai.assistant@chatsphere.ai",
                hashed_password=None,
                profile_photo="https://api.dicebear.com/7.x/bottts/svg?seed=ai-assistant",
                status="online"
            )
            db.add(ai_user)
            db.commit()
            print("Successfully seeded AI Assistant virtual user.")
    except Exception as e:
        print(f"Error seeding AI Assistant: {e}")
    finally:
        db.close()
