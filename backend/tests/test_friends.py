def test_friendship_workflow(client):
    # 1. Register User A
    user_a = client.post("/api/auth/register", json={
        "username": "usera",
        "email": "usera@example.com",
        "password": "passwordA"
    }).json()
    token_a = user_a["access_token"]

    # 2. Register User B
    user_b = client.post("/api/auth/register", json={
        "username": "userb",
        "email": "userb@example.com",
        "password": "passwordB"
    }).json()
    token_b = user_b["access_token"]

    # 3. User A searches User B
    headers_a = {"Authorization": f"Bearer {token_a}"}
    search_resp = client.get("/api/users/search?q=userb", headers=headers_a)
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert len(search_data) == 1
    assert search_data[0]["username"] == "userb"
    assert search_data[0]["friendship_status"] is None

    # 4. User A sends Friend Request to User B
    req_resp = client.post(
        "/api/friends/request", 
        json={"receiver_username_or_email": "userb"}, 
        headers=headers_a
    )
    assert req_resp.status_code == 200
    req_data = req_resp.json()
    assert req_data["status"] == "pending"
    req_id = req_data["id"]

    # Search User B again -> friendship_status should be "sent_pending"
    search_resp = client.get("/api/users/search?q=userb", headers=headers_a)
    assert search_resp.json()[0]["friendship_status"] == "sent_pending"

    # Search User A from User B's perspective -> friendship_status should be "received_pending"
    headers_b = {"Authorization": f"Bearer {token_b}"}
    search_resp_b = client.get("/api/users/search?q=usera", headers=headers_b)
    assert search_resp_b.json()[0]["friendship_status"] == "received_pending"

    # 5. User B fetches pending requests
    pending_resp = client.get("/api/friends/requests/pending", headers=headers_b)
    assert pending_resp.status_code == 200
    pending_list = pending_resp.json()
    assert len(pending_list) == 1
    assert pending_list[0]["sender"]["username"] == "usera"

    # 6. User B accepts the request
    accept_resp = client.post(
        "/api/friends/respond",
        json={"request_id": req_id, "action": "accept"},
        headers=headers_b
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "accepted"

    # 7. Verify that User A and User B are friends
    friends_a = client.get("/api/friends/list", headers=headers_a).json()
    assert len(friends_a) == 1
    assert friends_a[0]["username"] == "userb"

    friends_b = client.get("/api/friends/list", headers=headers_b).json()
    assert len(friends_b) == 1
    assert friends_b[0]["username"] == "usera"

    # 8. Verify that a DM chat was automatically created
    chats_a = client.get("/api/chats", headers=headers_a).json()
    assert len(chats_a) == 1
    assert chats_a[0]["is_group"] is False
    assert chats_a[0]["name"] == "userb"  # DM shows other user's username
