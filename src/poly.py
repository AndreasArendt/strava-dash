import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../submodules/utils/python"))
import transformation

import math
import polyline
import matplotlib.pyplot as plt
import json
from cardconfig import CardConfig as cfg

def save_activities(activities):
    activities_json = []

    for a in activities:
        activities_json.append({
            "polyline": a["polyline"],
            "type": str(a["type"]),
            "name": a["name"],
            "id": a["id"],
            "date": str(a["date"])
        })

    with open("activities.json", "w") as j_file:
        json.dump(activities_json, j_file, indent=4)

def read_activities(path):
    with open(path, "r") as j_file:   
        json_data = json.load(j_file)
            
    return json_data

def convert_polylines_to_local_coords(polylines):    
    x_N = []
    y_N = []
    z_N = []
    
    for p in polylines:            
        coords = polyline.decode(p['polyline'])
        
        lat_rad = [math.radians(x[0]) for x in coords]
        lon_rad = [math.radians(x[1]) for x in coords]
        alt_m = [600]*len(lat_rad)
    
        [x, y, z] = transformation.wgs84_to_ned(lat_rad, lon_rad, alt_m)

        x_N.append(x)
        y_N.append(y)
        z_N.append(z)

    return x_N, y_N, z_N

def resize_trajectory(x_N, y_N):
    [nrow, ncol] = cfg.calc_grid_size(len(x_N))
    
    x_size = (cfg.card_height - (nrow+1) * cfg.spacing) / nrow    # North-South
    y_size = (cfg.card_width  - (ncol+1) * cfg.spacing) / ncol    # East-West

    x_scaled = []
    y_scaled = []

    for x, y in zip(x_N, y_N):
        x_new = x - min(x)
        y_new = y - min(y)

        north_south_spread = max(x_new)
        east_west_spread   = max(y_new)

        x_scale = x_size / north_south_spread
        y_scale = y_size / east_west_spread
                
        x_scaled.append(x_new * x_scale)
        y_scaled.append(y_new * y_scale)

    return x_scaled, y_scaled

def plot_trajectory(x_N, y_N, activities):
    col = 0
    [nrow, _] = cfg.calc_grid_size(len(activities))

    row = nrow-1
    plt.figure(figsize=(cfg.card_width/0.0254, cfg.card_height/0.0254), dpi=cfg.dpi)

    for x, y, a in zip(x_N, y_N, activities):
        max_x = max(x)
        max_y = max(y)

        space_x = max_x + cfg.spacing
        space_y = max_y + cfg.spacing

        if a['type'] == 'root=\'Run\'':
            color = '#2A3B3A'
        elif a['type'] == 'root=\'NordicSki\'':
            color = '#A71819'
        elif a['type'] == 'root=\'Ride\'':
            color = '#73ba9b'
        elif a['type'] == 'root=\'Hike\'':
            color = '#c36d52'
        elif a['type'] == 'root=\'Swim\'':
            color = "#187c9d"
        else:
            color = ''

        plt.plot(y+col*space_y, x+row*space_x, color=color)
                
        if row == 0:        
            row = nrow-1
            col += 1
        else:
            row -=1

        #plt.pause(0.05)
    
    plt.ylim([0-cfg.spacing, cfg.card_height+cfg.spacing])
    plt.xlim([0-cfg.spacing, cfg.card_width+cfg.spacing])
    plt.axis('off')
    plt.tight_layout()
    
    return plt