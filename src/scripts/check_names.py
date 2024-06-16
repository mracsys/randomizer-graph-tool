#!/usr/bin/env python3
import os
import sys
import json
from glob import glob
sys.path.append('/home/mracsys/git/OoT-Randomizer-Fork')
from LocationList import location_table
from EntranceShuffle import entrance_shuffle_table
from Utils import read_logic_file

with open('DisplayNames.json', 'r') as f:
    aliases = json.load(f)

with open('ScreenedNames.json', 'r') as f:
    screened = json.load(f)

new_locations = []
for location_name in location_table.keys():
    if location_name not in aliases['location_aliases'].keys() and location_name not in screened['locations']:
        new_locations.append(location_name)

new_entrances = []
for type, forward_entry, *return_entry in entrance_shuffle_table:
    if type != 'Overworld' and forward_entry[0] not in aliases['entrance_aliases'].keys() and forward_entry[0] not in screened['entrances']:
        new_entrances.append(forward_entry[0])
    #if return_entry:
    #    if return_entry[0][0] not in aliases['entrance_aliases'].keys():
    #        new_entrances.append(return_entry[0][0])

grouped_regions = []
for _, regions in aliases['region_groups'].items():
    grouped_regions.extend(regions)

new_regions = []
for logic_file in glob('/home/mracsys/git/OoT-Randomizer-Fork/data/World/*.json'):
    logic = read_logic_file(logic_file)
    for region in logic:
        if region['region_name'] not in grouped_regions and region['region_name'] not in screened['regions']:
            new_regions.append(region['region_name'])
for logic_file in glob('/home/mracsys/git/OoT-Randomizer-Fork/data/Glitched World/*.json'):
    logic = read_logic_file(logic_file)
    for region in logic:
        if region['region_name'] not in grouped_regions and region['region_name'] not in screened['regions']:
            new_regions.append(region['region_name'])

new_names = {
    'locations': {l: '' for l in new_locations},
    'entrances': {e: '' for e in new_entrances},
    'regions': new_regions,
}

if os.path.exists('./locations'):
    for old_tootr_file in glob('./locations/*.json'):
        with open(old_tootr_file, 'r') as f:
            old_data = json.load(f)
        for location_name, location_data in old_data['locations'].items():
            if location_name in new_names['locations'].keys():
                new_names['locations'][location_name] = location_data['alias']

with open('NewNames.json', 'w') as f:
    json.dump(new_names, f, indent=4)
