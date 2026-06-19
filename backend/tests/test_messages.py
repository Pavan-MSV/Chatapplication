def test_messages_and_groups_workflow(client):
    # 1. Register User A and User B
    user_a = client.post("/api/auth/register", json={
        "username": "usera", "email": "usera@example.com", "password": "passwordA"
    }).json()
    token_a = user_a["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    user_b = client.post("/api/auth/register", json={
        "username": "userb", "email": "userb@example.com", "password": "passwordB"
    }).json()
    token_b = user_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 2. Establish Friendship so they have a DM
    req = client.post("/api/friends/request", json={"receiver_username_or_email": "userb"}, headers=headers_a).json()
    client.post("/api/friends/respond", json={"request_id": req["id"], "action": "accept"}, headers=headers_b)

    chats_a = client.get("/api/chats", headers=headers_a).json()
    dm_chat_id = chats_a[0]["id"]

    # 3. User A sends message to User B
    msg_resp = client.post(
        "/api/messages", 
        json={"chat_id": dm_chat_id, "content": "Hello User B!", "message_type": "text"},
        headers=headers_a
    )
    assert msg_resp.status_code == 200
    msg_id = msg_resp.json()["id"]

    # 4. User B gets message history
    history = client.get(f"/api/messages?chat_id={dm_chat_id}", headers=headers_b).json()
    assert len(history) == 1
    assert history[0]["content"] == "Hello User B!"
    assert history[0]["is_seen"] is False

    # 5. User B marks messages as seen
    seen_resp = client.post(f"/api/messages/seen/{dm_chat_id}", headers=headers_b)
    assert seen_resp.status_code == 200

    # Get history again -> should be seen
    history = client.get(f"/api/messages?chat_id={dm_chat_id}", headers=headers_b).json()
    assert history[0]["is_seen"] is True

    # 6. Test AI Suggestion
    suggestions = client.get(f"/api/ai/suggestions?chat_id={dm_chat_id}", headers=headers_b).json()
    assert "suggestions" in suggestions
    assert len(suggestions["suggestions"]) == 3

    # 7. Create Group Chat with User A and User B
    group_payload = {
        "name": "Design Team",
        "description": "Discuss styles",
        "member_ids": [user_b["user_id"]]
    }
    group_chat = client.post("/api/chats/group", json=group_payload, headers=headers_a).json()
    group_chat_id = group_chat["id"]
    assert group_chat["is_group"] is True
    assert group_chat["name"] == "Design Team"
    # User A (admin) and User B (member) should be in list
    assert len(group_chat["members"]) == 2

    # 8. User B gets chats list -> should see Group chat
    chats_b = client.get("/api/chats", headers=headers_b).json()
    # Should have 2 chats now (DM and Group)
    assert len(chats_b) == 2
