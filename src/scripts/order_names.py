#!/usr/bin/env python3
import os
import json
from glob import glob

with open('DisplayNames.json', 'r') as f:
    aliases = json.load(f)

display_locations = [l for l in aliases['location_aliases'].keys()]
display_entrances = [e for e in aliases['entrance_aliases'].keys()]

ordered_locations = []
ordered_entrances = []
unknown_locations = []
unknown_entrances = []

if os.path.exists('./locations'):
    for old_tootr_file in glob('./locations/*.json'):
        with open(old_tootr_file, 'r') as f:
            old_data = json.load(f)
        for location_name in old_data['locations'].keys():
            if location_name in display_locations:
                ordered_locations.append(location_name)
            else:
                unknown_locations.append(location_name)
        for entrance_name in old_data['entrances'].keys():
            if entrance_name in display_entrances:
                ordered_entrances.append(entrance_name)
            else:
                unknown_entrances.append(entrance_name)

ordered_locations.extend(unknown_locations)
ordered_entrances.extend(unknown_entrances)

ordered_names = {
    'locations': ordered_locations,
    'entrances': ordered_entrances,
}

with open('OrderedNames.json', 'w') as f:
    json.dump(ordered_names, f, indent=4)
