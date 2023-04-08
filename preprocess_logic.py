import io
import re
import json
import os

def read_json(file_path):
    json_string = ""
    with io.open(file_path, 'r') as file:
        for line in file.readlines():
            json_string += line.split('#')[0].replace('\n', ' ')
    json_string = re.sub(' +', ' ', json_string)
    try:
        test_json = json.loads(json_string)
        with io.open(file_path, 'w') as file:
            file.write(json_string)
    except json.JSONDecodeError as error:
        raise Exception("JSON parse error around text:\n" + \
                        json_string[error.pos-35:error.pos+35] + "\n" + \
                        "                                   ^^\n")

for filename in os.listdir('./ootr-logic'):
    read_json('./ootr-logic/' + filename)