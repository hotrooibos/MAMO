#!/usr/bin/env python
""" OVH tokens management
    Generate new credentials with full access to your account on the token creation
    page (https://api.ovh.com/createToken/index.cgi?GET=/*&PUT=/*&POST=/*&DELETE=/*)
"""
import json
import os
import ovh

ROOTDIR = os.path.dirname(os.path.abspath(__file__)) + "/../"
CONFIG = ROOTDIR + "/config.json"


def list_ovh_tokens(client: ovh.Client):
    result = client.get("/me/api/application")
    for id in result:
        token = client.get(f"/me/api/application/{id}")
        print(token)


def delete_ovh_token(client: ovh.Client, id: int):
    client.delete(f"/me/api/application/{id}")
    print(f"Token {id} have been deleted")


def purge_ovh_tokens(client: ovh.Client):
    result = client.get("/me/api/application")
    for id in result:
        token = client.delete(f"/me/api/application/{id}")
    print("All tokens have been deleted")


# Read config file
with open(file=CONFIG,
		  mode='r',
          encoding='utf-8') as json_file:
	config = json.load(json_file)

# Instianciate an ovh client
client = ovh.Client(
	endpoint = config["token"]["endpoint"],
	application_key = config["token"]["app_key"],
	application_secret = config["token"]["app_secret"],
	consumer_key = config["token"]["consumer_key"],
)

try:
    # delete_ovh_token(client, "259588")
    # purge_ovh_tokens(client) # !!! Delete ALL existing tokens !!!
    list_ovh_tokens(client)

except ovh.APIError as e:
    print(e)