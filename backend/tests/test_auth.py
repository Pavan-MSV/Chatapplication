from backend.app.models.user import User
import os

def test_register_and_login(client, db_session):
    # Set TESTING to False to trigger real OTP generation flow
    original_testing = os.environ.get("TESTING", "True")
    os.environ["TESTING"] = "False"
    
    try:
        # 1. Test Register (requires OTP verification)
        reg_payload = {
            "username": "tester",
            "email": "tester@example.com",
            "password": "securepassword123",
            "profile_photo": "http://photo.url"
        }
        response = client.post("/api/auth/register", json=reg_payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" not in data
        assert data["email"] == "tester@example.com"
        assert data["is_verified"] is False

        # 2. Test Register Duplicate (unverified same email is allowed, returns 200 re-sending OTP)
        response_dup = client.post("/api/auth/register", json=reg_payload)
        assert response_dup.status_code == 200

        # 3. Test Login unverified user (should fail with 403)
        login_payload = {
            "email": "tester@example.com",
            "password": "securepassword123"
        }
        response_login_unverified = client.post("/api/auth/login", json=login_payload)
        assert response_login_unverified.status_code == 403

        # 4. Fetch the OTP code directly from database to test verify-otp
        user_in_db = db_session.query(User).filter(User.email == "tester@example.com").first()
        assert user_in_db is not None
        assert user_in_db.otp_code is not None

        # 5. Verify OTP (successful)
        verify_payload = {
            "email": "tester@example.com",
            "otp_code": user_in_db.otp_code
        }
        response_verify = client.post("/api/auth/verify-otp", json=verify_payload)
        assert response_verify.status_code == 200
        verify_data = response_verify.json()
        assert "access_token" in verify_data
        token = verify_data["access_token"]

        # 6. Test Register Duplicate (now verified, should fail with 400)
        response_dup_verified = client.post("/api/auth/register", json=reg_payload)
        assert response_dup_verified.status_code == 400

        # 7. Test Login (now verified)
        response_login = client.post("/api/auth/login", json=login_payload)
        assert response_login.status_code == 200
        login_data = response_login.json()
        assert login_data["access_token"] is not None

        # 8. Test Login Wrong Password
        login_payload["password"] = "wrongpassword"
        response_wrong = client.post("/api/auth/login", json=login_payload)
        assert response_wrong.status_code == 401

        # 9. Test Get Me
        headers = {"Authorization": f"Bearer {token}"}
        response_me = client.get("/api/auth/me", headers=headers)
        assert response_me.status_code == 200
        me_data = response_me.json()
        assert me_data["username"] == "tester"
        assert me_data["email"] == "tester@example.com"
    finally:
        os.environ["TESTING"] = original_testing
