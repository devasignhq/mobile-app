**Solution: Implement GET /conversations/:bountyId/messages**

To solve this issue, we will create a new API endpoint that retrieves the message history for a bounty conversation. We will use cursor-based pagination to limit the number of messages returned in each response.

**Endpoint:** `GET /conversations/:bountyId/messages`

**Request Parameters:**

* `bountyId`: The ID of the bounty conversation
* `cursor`: The cursor to use for pagination (optional)
* `per_page`: The number of messages to return per page (optional, default: 30)

**Response:**

* `messages`: An array of message objects
* `cursor`: The cursor to use for the next page of results
* `has_next_page`: A boolean indicating whether there are more messages to retrieve

**Implementation:**
```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from github import Github

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
db = SQLAlchemy(app)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bounty_id = db.Column(db.Integer, db.ForeignKey("bounty.id"))
    text = db.Column(db.Text)
    created_at = db.Column(db.DateTime)

class Bounty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(db.Integer)
    assigned_developer_id = db.Column(db.Integer)

@app.route("/conversations/<int:bounty_id>/messages", methods=["GET"])
def get_messages(bounty_id):
    # Check if the user is the bounty creator or assigned developer
    github = Github()
    repo = github.get_repo("devasignhq/mobile-app")
    issue = repo.get_issue(125)
    if issue.assignee.login != request.user.login and issue.user.login != request.user.login:
        return jsonify({"error": "Unauthorized"}), 401

    # Get the messages for the bounty conversation
    messages = Message.query.filter_by(bounty_id=bounty_id).order_by(Message.created_at.asc())

    # Apply cursor-based pagination
    cursor = request.args.get("cursor")
    per_page = int(request.args.get("per_page", 30))
    if cursor:
        messages = messages.filter(Message.created_at > cursor)
    messages = messages.limit(per_page)

    # Get the next cursor
    next_cursor = None
    if messages.count() == per_page:
        next_cursor = messages[-1].created_at

    # Return the response
    return jsonify({
        "messages": [{"id": m.id, "text": m.text, "created_at": m.created_at} for m in messages],
        "cursor": next_cursor,
        "has_next_page": next_cursor is not None
    })

if __name__ == "__main__":
    app.run(debug=True)
```
**Example Use Case:**

* `GET /conversations/123/messages` returns the first 30 messages for the bounty conversation with ID 123
* `GET /conversations/123/messages?cursor=2022-01-01T12:00:00Z` returns the next 30 messages for the bounty conversation with ID 123, starting from the message created after 2022-01-01T12:00:00Z

**Commit Message:**

`Implement GET /conversations/:bountyId/messages — message history`

**API Documentation:**

* `GET /conversations/:bountyId/messages`: Returns the message history for a bounty conversation
	+ Request Parameters:
		- `bountyId`: The ID of the bounty conversation
		- `cursor`: The cursor to use for pagination (optional)
		- `per_page`: The number of messages to return per page (optional, default: 30)
	+ Response:
		- `messages`: An array of message objects
		- `cursor`: The cursor to use for the next page of results
		- `has_next_page`: A boolean indicating whether there are more messages to retrieve