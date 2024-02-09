# -*- encoding: utf-8 -*-
import json
import os
import ovh

ROOTDIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = ROOTDIR + "/config.json"

# Read config file
with open(file=CONFIG,
		  mode='r',
          encoding='utf-8') as json_file:
	config = json.load(json_file)

print(config["token"]["endpoint"])

# Instantiate an OVH Client.
# You can generate new credentials with full access to your account on
# the token creation page (https://api.ovh.com/createToken/index.cgi?GET=/*&PUT=/*&POST=/*&DELETE=/*)
client = ovh.Client(
	endpoint = config["token"]["endpoint"],
	application_key = config["token"]["app_key"],
	application_secret = config["token"]["app_secret"],
	consumer_key = config["token"]["consumer_key"],
)

redirs_remote = client.get(f'/email/domain/tical.fr/redirection')
redirs = {}

while (True):
	action = input("0 : show active redirections\n1 : create redir\n2 : mod redir\n3 : remove redir\nAction ? ")

	if (action == "0"):
		if (len(redirs) < 1):
			print("Please wait, downloading redirections from OVH")
			for id in redirs_remote:
				r = client.get(f'/email/domain/tical.fr/redirection/{id}')
				redirs[r["id"]] = [r["from"], r["to"]]
		

		for k, v in redirs.items():
			print(f'{v[0]} -> {v[1]}')
		# print (redirs)

	elif (action == "1"):
		print("Create a new redirection")
		website = input("Website (format : website.com) ? ")
	elif (action == "2"):
		print("mod...")
	elif (action == "3"):
		print("rm...")
	else :
		print("Unknown action")

	print(len(redirs))

# Listing des applications/tokens API OVH en cours de validité
# result = client.get("/me/api/application")

