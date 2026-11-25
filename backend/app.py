import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv()

app = Flask(__name__)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured."
    )


@app.after_request
def add_cors_headers(response):
    # The separately hosted static frontend calls this API from the browser.
    # Set CORS_ORIGIN to the deployed frontend origin, or leave unset during
    # development to allow local static servers on another port.
    response.headers["Access-Control-Allow-Origin"] = os.environ.get("CORS_ORIGIN", "*")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

supabase: Client = create_client(
    supabase_url,
    supabase_key,
)


def database_error(error: APIError):
    app.logger.error("Supabase request failed: %s", error.message)
    if getattr(error, "code", None) == "23505":
        return jsonify({"error": "Registration already exists."}), 409
    return jsonify({"error": error.message}), 502


@app.get("/")
def index():
    return jsonify(
        {
            "service": "events-api",
            "endpoints": [
                "GET /api/events",
                "GET /api/events/<id>",
                "POST /api/registrations",
                "GET /api/me/registrations?user_id=<id>",
                "GET /api/events/<id>/registrations",
            ],
        }
    )


@app.get("/api/events")
def list_events():
    try:
        response = supabase.table("events").select("*").execute()
    except APIError as error:
        return database_error(error)
    return jsonify(response.data)


@app.get("/api/events/<event_id>")
def get_event(event_id: str):
    try:
        response = (
            supabase.table("events")
            .select("*")
            .eq("id", event_id)
            .execute()
        )
    except APIError as error:
        return database_error(error)

    if not response.data:
        return jsonify({"error": "Event not found."}), 404
    return jsonify(response.data[0])


@app.post("/api/registrations")
def create_registration():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    user_id = payload.get("user_id")
    event_id = payload.get("event_id")
    if not isinstance(user_id, str) or not user_id.strip():
        return jsonify({"error": "user_id is required."}), 400
    if not isinstance(event_id, str) or not event_id.strip():
        return jsonify({"error": "event_id is required."}), 400

    try:
        user_response = (
            supabase.table("users").select("id").eq("id", user_id).execute()
        )
        if not user_response.data:
            return jsonify({"error": "User not found."}), 404

        event_response = (
            supabase.table("events")
            .select("id, capacity")
            .eq("id", event_id)
            .execute()
        )
        if not event_response.data:
            return jsonify({"error": "Event not found."}), 404

        existing = (
            supabase.table("registrations")
            .select("id")
            .eq("user_id", user_id)
            .eq("event_id", event_id)
            .execute()
        )
        if existing.data:
            return jsonify({"error": "User is already registered for this event."}), 409

        capacity = event_response.data[0]["capacity"]
        if capacity is not None:
            registrations = (
                supabase.table("registrations")
                .select("id")
                .eq("event_id", event_id)
                .execute()
            )
            if len(registrations.data) >= capacity:
                return jsonify({"error": "Event is at capacity."}), 409

        response = (
            supabase.table("registrations")
            .insert({"user_id": user_id, "event_id": event_id})
            .execute()
        )
    except APIError as error:
        return database_error(error)

    return jsonify(response.data[0]), 201


@app.get("/api/me/registrations")
def list_user_registrations():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id query parameter is required."}), 400

    try:
        response = (
            supabase.table("registrations")
            .select("*, events(*)")
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as error:
        return database_error(error)
    return jsonify(response.data)


@app.get("/api/events/<event_id>/registrations")
def list_event_registrations(event_id: str):
    try:
        event_response = (
            supabase.table("events").select("id").eq("id", event_id).execute()
        )
        if not event_response.data:
            return jsonify({"error": "Event not found."}), 404

        response = (
            supabase.table("registrations")
            .select("id, user_id, event_id, created_at, users(id, email)")
            .eq("event_id", event_id)
            .execute()
        )
    except APIError as error:
        return database_error(error)
    return jsonify(response.data)


if __name__ == "__main__":
    app.run(debug=True)
