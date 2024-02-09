# -*- encoding: utf-8 -*-
import json
import os
import ovh
import time

ROOTDIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = ROOTDIR + "/config.json"
domain = "tical.fr"

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

redirs_remote = client.get(f'/email/domain/{domain}/redirection')
redirs = {}

def synchro_check(id: int):
	'''
		Check if the local (config.json) informations for the given id
		is equals to the remote (ovh api) informations
	'''
	if (id not in redirs):
		return 1

	r = client.get(f'/email/domain/{domain}/redirection/{id}')
	
	for k, v in redirs.items():
		if (k == r["id"]):
			# Desync on the from @
			if (v[0] != r["from"]):
				# TODO demander quelle info garder et màj json/ovh en conséquence
				return 2
			# Desync on the destination @
			if (v[1] != r["to"]):
				# TODO demander quelle info garder et màj json/ovh en conséquence
				return 3
	
	# Synchro check OK
	return 0


while (True):
	action = input("0 : show active redirections\n1 : create redir\n2 : mod redir\n3 : remove redir\nAction ? ")

	if (action == "0"):
		if (len(redirs) < 1):
			print("Retrieving redirections from OVH...")
			
			for id in redirs_remote:
				r = client.get(f'/email/domain/{domain}/redirection/{id}')
				redirs[r["id"]] = [r["from"], r["to"]]
		
		for k, v in redirs.items():
			print(f'{v[0]} -> {v[1]}')
			# TODO si id n'existe pas dans json, le créer
			synchro_check(k)
			# TODO tri : date de création > ordre alphab du domaine > ordre alphab mail

	elif (action == "1"):
		print("Create a new redirection")
		website = input("Label or website (ex: amazin.com) ? ")
		dest = input("Destination (ex: john@doe.com) ? ")
		desc = input("Description ? ")
		epoch = time.time()
		# TODO Générer un hash
		# TODO Créer la redir via l'api
		# TODO Récupérer l'id ovh
		# TODO Insérer dans la conf : id, date, from, to

	elif (action == "2"):
		print("Edit an existing redirection")
		id = input("ID of the redir to edit ? ")

		for k, v in redirs.items():
			if (k == id):
				id = k
				fm = v[0]
				to = v[1]
				synchro_check(id)
				break

		dest = input("New destination (ex: john@doe.com) ? ")
		desc = input(f"Description ?\nCurrent description : {}")

		epoch = time.time()
		# TODO Mod la redir via l'api
		# TODO Mod la conf à l'id : date, from, to

	elif (action == "3"):
		print("rm...")
	else :
		print("Unknown action")


# Listing des applications/tokens API OVH en cours de validité
# result = client.get("/me/api/application")

