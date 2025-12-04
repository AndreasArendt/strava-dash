import json
import datetime
import requests
from stravalib import Client
import os
import webbrowser


class StravaAPI:

    def __init__(self):
        self.access_token = None
        self.refresh_token = None
        self.expires_at = None
        self.client = None

    def load_tokens(self, filename="tokens.json"):
        if not os.path.exists(filename):
            return False

        with open(filename) as f:
            data = json.load(f)

        self.access_token = data.get("access_token")
        self.refresh_token = data.get("refresh_token")
        self.expires_at = data.get("expires_at")

        if self.access_token:
            self.client = Client(access_token=self.access_token)

        return True

    def save_tokens(self, data, filename="tokens.json"):
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)

    def authorize(self):
        print("Opening browser for Strava authentication...")
        webbrowser.open("https://strava-dash-zeta.vercel.app/api/start")

    def refresh(self):
        url = f"https://strava-dash-zeta.vercel.app/api/refresh?refresh_token={self.refresh_token}"
        r = requests.get(url).json()

        if "access_token" in r:
            self.save_tokens(r)
            self.load_tokens()
            print("Token refreshed.")
        else:
            print("Refresh failed:", r)

    def ensure_token(self):
        if not self.access_token:
            return False

        if datetime.datetime.now().timestamp() > self.expires_at - 60:
            print("Token expired → refreshing…")
            self.refresh()

        return True

    def get_activities(self, after="2023-01-01"):
        self.ensure_token()

        acts = self.client.get_activities(after=after)
        out = []

        for a in acts:
            if a.map.summary_polyline:
                out.append({
                    "polyline": a.map.summary_polyline,
                    "type": a.type,
                    "name": a.name,
                    "id": a.id,
                    "date": str(a.start_date)
                })

        return out
