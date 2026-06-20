import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os

# Set environment variables for testing
os.environ["DEV_BYPASS_FIREBASE"] = "True"
os.environ["TESTING"] = "True"

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models.user import User

# In-memory SQLite with StaticPool shares the single connection across all threads
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function", autouse=True)
def init_test_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Seed AI Assistant user
    db = TestingSessionLocal()
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
    db.close()
    
    yield
    
    # Drop tables
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
