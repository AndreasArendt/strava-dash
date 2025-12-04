import json
import time
import requests
import webbrowser
from stravaapi import StravaAPI
import os
import poly
from cardconfig import CardConfig as cfg
import matplotlib.pyplot as plt


def acquire_data():
    sapi = StravaAPI()

    # If no token → login flow
    if not sapi.load_tokens():
        sapi.authorize()
        input("After clicking 'return token to Python' in the browser, press Enter here...")

        # Token endpoint lives at /api/token (previously pointing to non-existent /api/print_token)
        token = None
        for attempt in range(5):
            try:
                r = requests.get("https://strava-dash-zeta.vercel.app/api/token")
                if r.status_code == 200:
                    token = r.json()
                    if "access_token" not in token:
                        print(f"Token payload missing access_token: {token}")
                        token = None
                    else:
                        break
                else:
                    print(f"Token endpoint returned {r.status_code}: {r.text}")
            except Exception as e:
                print(f"Token endpoint error: {e}")

            time.sleep(1)

        # Manual fallback: paste JSON shown in browser if endpoint did not return it
        if not token:
            manual = input("Paste token JSON from browser (or leave blank to abort): ").strip()
            if manual:
                try:
                    token = json.loads(manual)
                except Exception as e:
                    raise RuntimeError(f"Could not parse pasted token JSON: {e}") from e
            else:
                raise RuntimeError("No token received.")

        print(token)
        sapi.save_tokens(token)
        sapi.load_tokens()

    # Fetch activities
    activities = sapi.get_activities()
    poly.save_activities(activities)
    sapi.get_map_file()

    return activities


# Run flow if no cache
if not os.path.exists("activities.json"):
    acts = acquire_data()
else:
    acts = poly.read_activities("activities.json")

# Plot
[xN, yN, _] = poly.convert_polylines_to_local_coords(acts)
[xNew, yNew] = poly.resize_trajectory(xN, yN)
plt = poly.plot_trajectory(xNew, yNew, acts)
plt.savefig("card.svg", format="svg", dpi=cfg.dpi)
print("card.svg generated successfully.")
