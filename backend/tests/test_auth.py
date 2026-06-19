def test_register_and_login(client):
    # 1. Test Register
    reg_payload = {
        "username": "tester",
        "email": "tester@example.com",
        "password": "securepassword123",
        "profile_photo": "http://photo.url"
    }
    response = client.post("/api/auth/register", json=reg_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["username"] == "tester"
    assert data["email"] == "tester@example.com"
    token = data["access_token"]

    # 2. Test Register Duplicate
    response_dup = client.post("/api/auth/register", json=reg_payload)
    assert response_dup.status_code == 400

    # 3. Test Login
    login_payload = {
        "email": "tester@example.com",
        "password": "securepassword123"
    }
    response_login = client.post("/api/auth/login", json=login_payload)
    assert response_login.status_code == 200
    login_data = response_login.json()
    assert login_data["access_token"] is not None

    # 4. Test Login Wrong Password
    login_payload["password"] = "wrongpassword"
    response_wrong = client.post("/api/auth/login", json=login_payload)
    assert response_wrong.status_code == 401

    # 5. Test Get Me
    headers = {"Authorization": f"Bearer {token}"}
    response_me = client.get("/api/auth/me", headers=headers)
    assert response_me.status_code == 200
    me_data = response_me.json()
    assert me_data["username"] == "tester"
    assert me_data["email"] == "tester@example.com"
