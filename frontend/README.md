# CampusVerse frontend

This is a static frontend for the Flask API in `../backend/app.py`. It uses the Academic Ethereal design direction and the event discovery, event detail, and student schedule references in the design folder.

## Run locally

1. Start the backend with its Supabase environment variables set:

   ```powershell
   cd ..\backend
   ..\venv\Scripts\python.exe app.py
   ```

2. In another terminal, serve this folder:

   ```powershell
   cd frontend
   python -m http.server 5173
   ```

3. Open `http://localhost:5173`. The frontend defaults to `http://localhost:5000` for the API. Use the settings control in the header to change the API URL and enter an existing Supabase user ID from the backend `users` table. That ID is required for registration and the personal registrations list.

For deployment, set `CORS_ORIGIN` in the backend environment to the frontend's origin. During local development the backend allows cross-origin requests by default.

The event cards read common event field names (`title`/`name`, `description`, `start_date`/`date`, `location`/`venue`, and `category`/`type`) so they can render the event records returned by `/api/events` without inventing records or unsupported preference data.

## Deploy to Render

The root `render.yaml` defines the Flask API service. If configuring it manually, use the repository root as the service root directory:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn backend.app:app`
- Required environment variables: `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`
- Set `CORS_ORIGIN` to the deployed frontend origin.

The root `requirements.txt` includes `backend/requirements.txt`, so both Render and local installs use the same dependency list. `.python-version` selects Python 3.13 on Render.

Deploy this folder as a separate Render Static Site with `frontend` as the publish directory and no build step. After both services deploy, open the frontend's connection settings and enter the API service's `https://...onrender.com` URL and an existing backend user ID.
